pipeline {
    agent any

    environment {
        DOCKER_REGISTRY_URL       = 'https://index.docker.io/v1/'
        IMAGE_NAME                = 'imen077/backend'
        IMAGE_TAG                 = "${env.BUILD_NUMBER}"
        DOCKER_CREDENTIALS_ID     = 'docker-credentials'
        KUBECONFIG_CREDENTIALS_ID = 'kubeconfig-file'
        SONAR_PROJECT_KEY         = 'backend'
        NAMESPACE                 = 'production'
        DEPLOYMENT_NAME           = 'backend'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 45, unit: 'MINUTES')
        timestamps()
        disableConcurrentBuilds()
    }

    stages {

        // ─────────────────────────────────────────────
        stage('🔍 Checkout') {
        // ─────────────────────────────────────────────
            steps {
                script {
                    echo '🔄 Checking out code...'
                    checkout scm
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_BRANCH = sh(
                        script: 'git rev-parse --abbrev-ref HEAD',
                        returnStdout: true
                    ).trim()
                    echo "📌 Branch: ${env.GIT_BRANCH}"
                    echo "📌 Commit: ${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('🔬 SonarQube Analysis') {
        // ─────────────────────────────────────────────
            steps {
                script {
                    echo '🔬 Running SonarQube analysis...'
                    withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                        withSonarQubeEnv('SonarQube') {
                            sh """
                                # Installer sonar-scanner si absent
                                if ! command -v sonar-scanner &> /dev/null; then
                                    echo "📦 Installing sonar-scanner..."
                                    npm install -g sonar-scanner --silent
                                fi

                                sonar-scanner \
                                  -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                                  -Dsonar.sources=src \
                                  -Dsonar.host.url=http://192.168.33.10:9000 \
                                  -Dsonar.login=${SONAR_TOKEN} \
                                  -Dsonar.exclusions=node_modules/**,dist/**,**/*.spec.ts
                            """
                        }
                    }
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('⏳ Quality Gate') {
        // ─────────────────────────────────────────────
            steps {
                script {
                    echo '⏳ Waiting for SonarQube Quality Gate...'
                    timeout(time: 5, unit: 'MINUTES') {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error "❌ Quality Gate failed: ${qg.status}"
                        }
                        echo '✅ Quality Gate passed!'
                    }
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('🐳 Build Docker Image') {
        // ─────────────────────────────────────────────
            steps {
                script {
                    echo "🐳 Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
                    dockerImage = docker.build("${IMAGE_NAME}:${IMAGE_TAG}")
                    sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest"
                    echo '✅ Docker image built successfully!'
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('📤 Push Docker Image') {
        // ─────────────────────────────────────────────
            steps {
                script {
                    echo '📤 Pushing Docker image to registry...'
                    docker.withRegistry(DOCKER_REGISTRY_URL, DOCKER_CREDENTIALS_ID) {
                        sh "docker push ${IMAGE_NAME}:${IMAGE_TAG}"
                        sh "docker push ${IMAGE_NAME}:latest"
                    }
                    echo '✅ Image pushed successfully!'
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('🚀 Deploy to Kubernetes') {
        // ─────────────────────────────────────────────
            steps {
                script {
                    echo '🚀 Deploying to Kubernetes...'
                    withCredentials([file(credentialsId: KUBECONFIG_CREDENTIALS_ID, variable: 'KUBECONFIG_FILE')]) {
                        dir('k8s') {
                            sh '''
                                echo "📝 Applying ConfigMap..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" apply -f configmap.yaml -n production

                                echo "🔐 Applying Secret..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" apply -f secret.yaml -n production

                                echo "💾 Applying PVC..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" apply -f pvc.yaml -n production

                                echo "🔌 Applying Service..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" apply -f service.yaml -n production

                                echo "📋 Applying Deployment..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" apply -f deployment.yaml -n production

                                echo "⏳ Waiting for rollout..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" rollout status deployment/backend \
                                    -n production --timeout=5m
                            '''
                        }
                    }
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('✅ Verify') {
        // ─────────────────────────────────────────────
            steps {
                script {
                    echo '✅ Verifying deployment...'
                    withCredentials([file(credentialsId: KUBECONFIG_CREDENTIALS_ID, variable: 'KUBECONFIG_FILE')]) {
                        sh '''
                            echo "📊 Deployment status:"
                            kubectl --kubeconfig="$KUBECONFIG_FILE" get deployment backend -n production

                            echo "📦 Pods:"
                            kubectl --kubeconfig="$KUBECONFIG_FILE" get pods -n production -l app=backend

                            echo "🔌 Service:"
                            kubectl --kubeconfig="$KUBECONFIG_FILE" get svc backend -n production

                            echo "📝 Recent events:"
                            kubectl --kubeconfig="$KUBECONFIG_FILE" get events -n production \
                                --sort-by=.lastTimestamp | tail -10
                        '''
                    }
                }
            }
        }

    }

    post {
        success {
            echo "✅ Backend pipeline succeeded! Build #${env.BUILD_NUMBER}"
            echo "📦 Image: ${IMAGE_NAME}:${IMAGE_TAG}"
            cleanWs()
        }
        failure {
            echo "❌ ERROR: Deployment failed!"
            cleanWs()
        }
        unstable {
            echo '⚠️ Build is unstable'
            cleanWs()
        }
    }
}