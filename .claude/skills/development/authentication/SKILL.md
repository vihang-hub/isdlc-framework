---
name: authentication-implementation
description: Implement authentication flows including OAuth2
skill_id: DEV-006
owner: software-developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Auth system development, OAuth integration
dependencies: [DEV-003]
---

# Authentication Implementation

## Purpose
Implement secure authentication including OAuth2 flows, JWT token management, and session handling.

## When to Use
- Auth system setup
- OAuth provider integration
- Token management
- Session handling

## Prerequisites
- Security architecture defined
- OAuth credentials available
- Token strategy decided

## Process

### Step 1: Configure OAuth Providers
```
OAuth setup:
- Register applications
- Configure redirect URIs
- Store credentials securely
```

### Step 2: Implement OAuth Flow
```
Flow steps:
- Authorization redirect
- Callback handling
- Token exchange
- User creation/lookup
```

### Step 3: Implement JWT
```
JWT implementation:
- Token generation
- Token validation
- Refresh token flow
- Token revocation
```

### Step 4: Secure Endpoints
```
Security:
- Auth guards
- Role guards
- Token refresh
- Logout
```

### Step 5: Handle Sessions
```
Session management:
- Cookie configuration
- Session storage
- Concurrent sessions
- Session invalidation
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| security_arch | Markdown | Yes | Auth design |
| oauth_config | JSON | Yes | Provider settings |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| auth_module | TypeScript | Auth implementation |
| strategies/ | TypeScript | Passport strategies |
| guards/ | TypeScript | Auth guards |

## Project-Specific Considerations
- Google OAuth
- University SSO (future)
- JWT with refresh tokens
- Cookie-based token storage

## Integration Points
- **Security Agent**: Security review
- **Test Manager**: Auth testing

## Examples
```typescript
// src/auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, VerifyCallback } from 'passport-google-oauth20'
import { ConfigService } from '@nestjs/config'
import { AuthService } from '../auth.service'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile']
    })
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback
  ): Promise<any> {
    const { emails, name, photos } = profile
    
    const user = await this.authService.findOrCreateOAuthUser({
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      provider: 'google',
      providerId: profile.id,
      avatar: photos[0]?.value
    })

    done(null, user)
  }
}

// src/auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async findOrCreateOAuthUser(data: OAuthUserData): Promise<User> {
    // Find existing OAuth account
    const oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider: data.provider,
          providerId: data.providerId
        }
      },
      include: { user: true }
    })

    if (oauthAccount) {
      return oauthAccount.user
    }

    // Check if user exists with this email
    let user = await this.prisma.user.findUnique({
      where: { email: data.email }
    })

    if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          emailVerified: true // OAuth emails are verified
        }
      })
    }

    // Link OAuth account
    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: data.provider,
        providerId: data.providerId
      }
    })

    return user
  }

  generateTokens(user: User): AuthTokens {
    const payload = { sub: user.id, email: user.email }

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: '15m'
    })

    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d'
      }
    )

    return { accessToken, refreshToken }
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET')
      })

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type')
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub }
      })

      if (!user) {
        throw new UnauthorizedException('User not found')
      }

      return this.generateTokens(user)
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }
}

// src/auth/auth.controller.ts
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Redirect to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Request() req, @Response() res) {
    const tokens = this.authService.generateTokens(req.user)
    
    // Set cookies
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    })

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.redirect(process.env.FRONTEND_URL + '/dashboard')
  }

  @Post('refresh')
  async refresh(@Request() req, @Response() res) {
    const refreshToken = req.cookies['refresh_token']
    
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token')
    }

    const tokens = await this.authService.refreshTokens(refreshToken)
    
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    })

    return { success: true }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Response() res) {
    res.clearCookie('access_token')
    res.clearCookie('refresh_token', { path: '/auth/refresh' })
    return { success: true }
  }
}
```

## Validation
- OAuth flow works
- Tokens generated correctly
- Refresh flow works
- Logout clears session
- Security reviewed