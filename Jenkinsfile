@Library('Pipeline-Helper@trunk')

properties([
    parameters([
        string(name: 'TAG', defaultValue: '', description: 'Git tag to release, e.g. v0.1.0-alpha', trim: true)
    ])
])

node('linux && release') {
    def tagName = params.TAG
    def packageVersion = ''
    def isPreRelease = false

    try {
        stage('Validate Tag') {
            if (!tagName || !tagName.matches(/^v\d+\.\d+\.\d+.*/)) {
                error("TAG parameter must match v<semver> (e.g. v0.1.0-alpha). Got: '${tagName}'")
            }
            echo "Building for tag: ${tagName}"
        }

        stage('Checkout') {
            checkout([
                $class: 'GitSCM',
                branches: [[name: "refs/tags/${tagName}"]],
                userRemoteConfigs: scm.userRemoteConfigs
            ])
        }

        stage('Install Dependencies') {
            def nodeHome = tool name: 'NodeJS-22', type: 'nodejs'
            env.PATH = "${nodeHome}/bin:${env.PATH}"
            sh 'node --version && npm --version'
            sh 'npm ci'
        }

        stage('Test') {
            sh 'npm run test:all'
        }

        stage('Validate Version') {
            packageVersion = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
            def tagVersion = tagName.replaceFirst('^v', '')
            if (tagVersion != packageVersion) {
                error("Version mismatch! Tag '${tagName}' → '${tagVersion}' but package.json has '${packageVersion}'")
            }
            isPreRelease = packageVersion.contains('-')
            echo "Version: ${packageVersion}, pre-release: ${isPreRelease}"
        }

        stage('Publish') {
            withCredentials([string(credentialsId: 'NPM_TOKEN', variable: 'NPM_TOKEN')]) {
                sh '''
                    cat > .npmrc <<EOF
@enactor:registry=https://npm.enactor.co.uk/
//npm.enactor.co.uk/:_authToken=${NPM_TOKEN}
always-auth=true
EOF
                '''

                sh 'npm publish --dry-run'
                def npmTag = isPreRelease ? '--tag next' : '--tag latest'
                sh "npm publish ${npmTag}"
            }
            echo "Published @enactor/isdlc@${packageVersion} to npm.enactor.co.uk"
        }

        stage('Create Gitea Release') {
            withCredentials([string(credentialsId: 'GITEA_RELEASE_TOKEN', variable: 'GITEA_TOKEN')]) {
                def releaseName = isPreRelease ? "v${packageVersion} (Pre-release)" : "v${packageVersion}"
                // Token header auth; if Apache proxy blocks it, fall back to basic auth
                def apiUrl = 'https://dev.enactor.co.uk/gitea/api/v1/repos/DevOpsInfra/isdlc-framework/releases'
                def payload = """{"tag_name":"${tagName}","name":"${releaseName}","body":"## @enactor/isdlc ${tagName}","draft":false,"prerelease":${isPreRelease}}"""
                sh """
                    curl -sf -X POST \
                      -H 'Content-Type: application/json' \
                      -H "Authorization: token \${GITEA_TOKEN}" \
                      -d '${payload}' \
                      '${apiUrl}' \
                    || curl -sf -X POST \
                      -H 'Content-Type: application/json' \
                      -u "jenkins.builduser:\${GITEA_TOKEN}" \
                      -d '${payload}' \
                      '${apiUrl}'
                """
            }
        }
    } catch (err) {
        currentBuild.result = 'FAILURE'
        throw err
    } finally {
        sh 'rm -f .npmrc'
        cleanWs()
    }
}
