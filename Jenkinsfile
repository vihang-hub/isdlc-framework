@Library('Pipeline-Helper@trunk')

node('linux && release') {
    def tagName = ''
    def packageVersion = ''
    def isPreRelease = false

    try {
        stage('Checkout') {
            checkout scm
            tagName = sh(script: "git describe --tags --exact-match 2>/dev/null || echo ''", returnStdout: true).trim()
            if (!tagName) {
                def branch = env.GIT_BRANCH ?: env.BRANCH_NAME ?: ''
                if (branch.contains('tags/')) {
                    tagName = branch.replaceAll('.*/tags/', '')
                }
            }
            if (!tagName || !tagName.startsWith('v')) {
                error("Not a version tag push. tag=${tagName}. Aborting.")
            }
            echo "Building for tag: ${tagName}"
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

        stage('Publish to Gitea') {
            withCredentials([string(credentialsId: 'NPM_TOKEN', variable: 'NPM_TOKEN')]) {
                sh '''
                    cat > .npmrc <<EOF
@enactor:registry=https://dev.enactor.co.uk/gitea/api/packages/DevOpsInfra/npm/
//dev.enactor.co.uk/gitea/api/packages/DevOpsInfra/npm/:_authToken=${NPM_TOKEN}
always-auth=true
EOF
                '''

                sh 'npm publish --dry-run'
                def npmTag = isPreRelease ? '--tag next' : '--tag latest'
                sh "npm publish ${npmTag}"
            }
            echo "Published @enactor/isdlc@${packageVersion} to Gitea"
        }

        stage('Create Gitea Release') {
            withCredentials([string(credentialsId: 'NPM_TOKEN', variable: 'GITEA_TOKEN')]) {
                def releaseName = isPreRelease ? "v${packageVersion} (Pre-release)" : "v${packageVersion}"
                sh """
                    curl -sf -X POST \
                      -H 'Content-Type: application/json' \
                      -H "Authorization: token \${GITEA_TOKEN}" \
                      -d '{"tag_name":"${tagName}","name":"${releaseName}","body":"## @enactor/isdlc ${tagName}","draft":false,"prerelease":${isPreRelease}}' \
                      'https://dev.enactor.co.uk/gitea/api/v1/repos/DevOpsInfra/isdlc-framework/releases'
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
