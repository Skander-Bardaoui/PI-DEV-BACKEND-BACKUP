# PI-DEV Backend API

Enterprise-grade ERP backend built with NestJS, TypeScript, and PostgreSQL. This API powers a comprehensive business management system with modules for sales, purchases, inventory, collaboration, and more.

## 🚀 Features

### Core Modules
- **Authentication & Authorization** - JWT-based auth with role-based access control
- **Multi-tenancy** - Business/tenant isolation with secure data segregation
- **Sales Management** - Invoices, quotes, sales orders, delivery notes, recurring invoices
- **Purchase Management** - Supplier management, purchase orders, goods receipts, 3-way matching
- **Inventory & Stock** - Warehouse management, stock movements, product tracking
- **Treasury & Payments** - Account management, payments, transfers, transactions
- **Collaboration** - Tasks, subtasks, comments, notifications, team management
- **Client Portal** - Secure client access with token-based authentication
- **Supplier Portal** - Supplier onboarding and order management

### AI-Powered Features
- **OCR Processing** - Automatic invoice/document data extraction
- **AI Email Generation** - Smart email drafting for invoices and quotes
- **3-Way Matching AI** - Intelligent PO/GR/Invoice reconciliation
- **Supplier Scoring** - AI-based supplier performance analysis
- **Subtask Generation** - Automatic task breakdown using AI

### Technical Features
- WebSocket support for real-time updates
- Email notifications with customizable templates
- PDF generation for documents
- File upload handling
- Database migrations
- Comprehensive error handling
- Request validation with DTOs
- API documentation ready

## 📋 Prerequisites

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm or yarn
- Gmail account (for email features)

## 🛠️ Installation

1. Clone the repository
```bash
git clone <repository-url>
cd PI-DEV-BACKEND
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=pi_dev_db

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRES_IN=30d

# Email (Gmail)
GMAIL_USER=your_email@gmail.com
GMAIL_PASS=your_app_password

# Frontend URL
FRONTEND_URL=http://localhost:5173

# AI Services (Optional)
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key

# Server
PORT=3001
```

4. Run database migrations
```bash
npm run migration:run
```

## 🚀 Running the Application

### Development Mode
```bash
npm run start:dev
```
Server runs on `http://localhost:3001`

### Production Mode
```bash
npm run build
npm run start:prod
```

### Watch Mode
```bash
npm run start
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📁 Project Structure

```
src/
├── auth/              # Authentication & authorization
├── businesses/        # Business/tenant management
├── users/            # User management
├── clients/          # Client management
├── sales/            # Sales module (invoices, quotes, orders)
├── Purchases/        # Purchase module (suppliers, POs, receipts)
├── stock/            # Inventory & warehouse management
├── payments/         # Treasury & payment management
├── collaboration/    # Tasks, comments, notifications
├── messages/         # Real-time messaging
├── subtasks/         # Task breakdown management
├── email/            # Email service
├── common/           # Shared utilities
└── migrations/       # Database migrations
```

## 🔑 Key API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `GET /auth/profile` - Get user profile

### Sales
- `GET /sales/invoices` - List invoices
- `POST /sales/invoices` - Create invoice
- `POST /sales/invoices/:id/send` - Send invoice by email
- `GET /sales/quotes` - List quotes
- `POST /sales/quotes` - Create quote

### Purchases
- `GET /purchases/suppliers` - List suppliers
- `POST /purchases/supplier-pos` - Create purchase order
- `POST /purchases/goods-receipts` - Create goods receipt
- `POST /purchases/three-way-matching` - Perform 3-way matching

### Collaboration
- `GET /tasks` - List tasks
- `POST /tasks` - Create task
- `POST /subtasks/generate` - AI-generate subtasks

## 🐳 Docker Deployment

```bash
# Build image
docker build -t pi-dev-backend .

# Run container
docker run -p 3001:3001 --env-file .env pi-dev-backend
```

## ☸️ Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 📚 Documentation

Additional documentation available in `/docs`:
- `AI_SUBTASK_GENERATION.md` - AI subtask generation guide
- `RAPPROCHEMENT_3_VOIES_IA.md` - 3-way matching documentation
- `COLLABORATION_COMPLETE.md` - Collaboration features
- `WAREHOUSE_FEATURE.md` - Warehouse management
- And more...

## 🔧 Database Migrations

```bash
# Generate migration
npm run migration:generate -- src/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## 🌐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_HOST` | PostgreSQL host | Yes |
| `DB_PORT` | PostgreSQL port | Yes |
| `DB_USERNAME` | Database username | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `DB_NAME` | Database name | Yes |
| `JWT_SECRET` | JWT secret key | Yes |
| `GMAIL_USER` | Gmail account for emails | Yes |
| `GMAIL_PASS` | Gmail app password | Yes |
| `FRONTEND_URL` | Frontend application URL | Yes |
| `GROQ_API_KEY` | Groq AI API key | No |
| `OPENAI_API_KEY` | OpenAI API key | No |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary and confidential.

## 👥 Support

For support and questions, contact the development team.

---

Built with ❤️ using [NestJS](https://nestjs.com/)
