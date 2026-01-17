---
name: frontend-development
description: Implement React UI components and pages
skill_id: DEV-005
owner: developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: UI implementation, component development
dependencies: [DEV-001, DEV-002]
---

# Frontend Development

## Purpose
Implement React components and pages that follow designs, handle state properly, and provide good user experience.

## When to Use
- UI component development
- Page implementation
- State management
- Form handling

## Prerequisites
- Wireframes/designs available
- Component specs defined
- API contracts known
- Design system (if any)

## Process

### Step 1: Review Design
```
Understand:
- Layout requirements
- Component breakdown
- Interactions
- Responsive behavior
```

### Step 2: Implement Components
```
Component structure:
- Props interface
- State management
- Event handlers
- Render logic
```

### Step 3: Handle State
```
State patterns:
- Local state (useState)
- Server state (React Query)
- Form state (React Hook Form)
- Global state (Context/Zustand)
```

### Step 4: Style Components
```
Styling approach:
- Tailwind CSS
- Component library
- Responsive design
- Accessibility
```

### Step 5: Write Tests
```
Test types:
- Unit tests (logic)
- Component tests (rendering)
- Integration tests (flows)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| wireframes | Images | Yes | UI designs |
| component_specs | Markdown | Yes | Component details |
| api_spec | YAML | Yes | API contracts |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| components/ | TSX | React components |
| pages/ | TSX | Page components |
| hooks/ | TypeScript | Custom hooks |

## Project-Specific Considerations
- Multi-step application form
- Search with filters
- Document upload UI
- Status dashboards

## Integration Points
- **Design Agent**: UI specifications
- **Test Manager**: Component tests
- **API Implementation**: Data fetching

## Examples
```typescript
// src/components/ApplicationCard/ApplicationCard.tsx
import { FC } from 'react'
import { Link } from 'react-router-dom'
import { Application } from '@/types'
import { StatusBadge } from '../StatusBadge'
import { ProgressBar } from '../ProgressBar'
import { formatDate, daysUntil } from '@/utils/date'

interface ApplicationCardProps {
  application: Application
  variant?: 'full' | 'compact'
}

export const ApplicationCard: FC<ApplicationCardProps> = ({ 
  application, 
  variant = 'full' 
}) => {
  const { program, status, progress, submittedAt } = application
  const daysLeft = program.deadline ? daysUntil(program.deadline) : null
  const isUrgent = daysLeft !== null && daysLeft <= 7 && status === 'draft'

  if (variant === 'compact') {
    return (
      <Link 
        to={`/applications/${application.id}`}
        className="flex items-center justify-between p-4 bg-white rounded-lg 
                   shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎓</span>
          <div>
            <p className="font-medium">{program.name}</p>
            <p className="text-sm text-gray-500">{program.university.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {status === 'draft' && (
            <span className="text-sm text-gray-500">{progress}%</span>
          )}
          <StatusBadge status={status} />
        </div>
      </Link>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎓</span>
          <div>
            <h3 className="font-semibold text-lg">{program.university.name}</h3>
            <p className="text-gray-600">{program.name}</p>
            <p className="text-sm text-gray-500">{program.degreeLevel}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === 'draft' && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        {status === 'draft' && daysLeft !== null && (
          <p className={isUrgent ? 'text-red-600 font-medium' : 'text-gray-500'}>
            {isUrgent && '⚠️ '}
            Deadline: {formatDate(program.deadline)} ({daysLeft} days)
          </p>
        )}
        {status === 'submitted' && submittedAt && (
          <p className="text-gray-500">
            Submitted: {formatDate(submittedAt)}
          </p>
        )}
        
        <div className="flex gap-2">
          {status === 'draft' ? (
            <Link
              to={`/applications/${application.id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg 
                         hover:bg-blue-700 transition-colors"
            >
              Continue
            </Link>
          ) : (
            <>
              <Link
                to={`/applications/${application.id}`}
                className="px-4 py-2 border border-gray-300 rounded-lg 
                           hover:bg-gray-50 transition-colors"
              >
                View
              </Link>
              <Link
                to={`/applications/${application.id}/status`}
                className="px-4 py-2 border border-gray-300 rounded-lg 
                           hover:bg-gray-50 transition-colors"
              >
                Track Status
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// src/components/ApplicationCard/ApplicationCard.test.tsx
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ApplicationCard } from './ApplicationCard'

const mockApplication = {
  id: 'app-1',
  status: 'draft',
  progress: 60,
  program: {
    name: 'MSc Computer Science',
    degreeLevel: 'master',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    university: { name: 'TU Munich' }
  }
}

const renderCard = (props = {}) => {
  return render(
    <BrowserRouter>
      <ApplicationCard application={mockApplication} {...props} />
    </BrowserRouter>
  )
}

describe('ApplicationCard', () => {
  it('renders university and program name', () => {
    renderCard()
    
    expect(screen.getByText('TU Munich')).toBeInTheDocument()
    expect(screen.getByText('MSc Computer Science')).toBeInTheDocument()
  })

  it('shows progress bar for draft applications', () => {
    renderCard()
    
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
  })

  it('shows Continue button for draft', () => {
    renderCard()
    
    expect(screen.getByRole('link', { name: /continue/i })).toBeInTheDocument()
  })

  it('shows View and Track buttons for submitted', () => {
    renderCard({ 
      application: { ...mockApplication, status: 'submitted', progress: 100 } 
    })
    
    expect(screen.getByRole('link', { name: /view/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /track status/i })).toBeInTheDocument()
  })

  it('shows urgent warning when deadline is soon', () => {
    renderCard()
    
    expect(screen.getByText(/⚠️/)).toBeInTheDocument()
  })
})
```

## Validation
- Matches wireframes
- Components tested
- Responsive design
- Accessibility compliant
- State managed properly