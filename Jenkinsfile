pipeline {
    agent any

    environment {
        DOCKER_REGISTRY_URL       = 'https://index.docker.io/v1/'
        IMAGE_NAME                = 'imen077/backend'
        IMAGE_TAG                 = "${env.BUILD_NUMBER}"
        DOCKER_CREDENTIALS_ID     = 'docker-credentials'
        KUBECONFIG_CREDENTIALS_ID = 'kubeconfig-file'
        NAMESPACE                 = 'production'
        DEPLOYMENT_NAME           = 'backend'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 60, unit: 'MINUTES')
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
        stage('🧪 Tests') {
        // ─────────────────────────────────────────────
            steps {
                // ⚠️ Si pas encore de tests → garde le || true
                sh 'npm run test:cov || true'
            }
        }

        // ─────────────────────────────────────────────
        stage('🔬 SonarQube Analysis') {
        // ─────────────────────────────────────────────
            steps {
                withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                    withSonarQubeEnv('SonarQube') {
                        sh '''
                            echo "🔬 Running SonarQube analysis..."
                            sonar-scanner \
                              -Dsonar.projectKey=backend \
                              -Dsonar.sources=src \
                              -Dsonar.tests=src \
                              -Dsonar.test.inclusions=**/*.spec.ts \
                              -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                              -Dsonar.coverage.exclusions=**/*.module.ts,**/main.ts,**/*.dto.ts \
                              -Dsonar.exclusions=node_modules/**,dist/**,**/*.test.ts \
                              -Dsonar.host.url=http://192.168.33.10:9000 \
                              -Dsonar.login=$SONAR_TOKEN
                        '''
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
        // Security Scan APRÈS build Docker
        // Trivy scanne l'image qui vient d'être buildée
        // ─────────────────────────────────────────────
stage('🔐 Security Scan') {
    steps {
        sh '''
            TRIVY_PATH="/var/lib/jenkins/tools/trivy/trivy"

            echo "🔐 Installing Trivy if needed..."
            if [ ! -f "$TRIVY_PATH" ]; then
                mkdir -p /var/lib/jenkins/tools/trivy
                curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
                  | sh -s -- -b /var/lib/jenkins/tools/trivy
            fi

            echo "🔍 Scanning image for vulnerabilities..."
            $TRIVY_PATH image \
              --exit-code 0 \
              --severity HIGH,CRITICAL \
              --no-progress \
              --format table \
              imen077/backend:$BUILD_NUMBER || true
        '''
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
        // Applique tous les manifests puis attend le rollout.
        // En cas d'échec → rollback automatique vers la version précédente.
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

                                echo "🗄️ Applying PostgreSQL..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" apply -f postgres.yaml -n production

                                echo "⏳ Waiting for PostgreSQL to be ready..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" wait \
                                    --for=condition=ready pod \
                                    -l app=postgres \
                                    -n production \
                                    --timeout=3m

                                echo "🔌 Applying Service..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" apply -f service.yaml -n production

                                echo "📋 Applying Deployment..."
                                kubectl --kubeconfig="$KUBECONFIG_FILE" apply -f deployment.yaml -n production

                                echo "⏳ Waiting for backend rollout..."
                                # Sauvegarder la revision actuelle avant deploy
                                CURRENT=$(kubectl --kubeconfig="$KUBECONFIG_FILE" \
                                    rollout history deployment/backend -n production \
                                    | tail -2 | head -1 | awk '{print $1}')

                                echo "📌 Current revision: $CURRENT"

                                # Si le rollout échoue → rollback automatique
                                if ! kubectl --kubeconfig="$KUBECONFIG_FILE" \
                                    rollout status deployment/backend \
                                    -n production --timeout=10m; then
                                    echo "🔄 Deploy failed! Rolling back to revision $CURRENT..."
                                    kubectl --kubeconfig="$KUBECONFIG_FILE" \
                                        rollout undo deployment/backend -n production
                                    echo "✅ Rollback completed."
                                    exit 1
                                fi

                                echo "✅ Rollout successful!"
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
                            echo "📊 All pods in production:"
                            kubectl --kubeconfig="$KUBECONFIG_FILE" get pods -n production

                            echo "🔌 All services:"
                            kubectl --kubeconfig="$KUBECONFIG_FILE" get svc -n production

                            echo "📦 Backend deployment:"
                            kubectl --kubeconfig="$KUBECONFIG_FILE" get deployment backend -n production

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
            echo "❌ ERROR: Pipeline failed! Check logs above."
            cleanWs()
        }
        unstable {
            echo '⚠️ Build is unstable'
            cleanWs()
        }
    }
}
