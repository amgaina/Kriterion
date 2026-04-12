# Complete Environment Setup Guide

This guide helps you set up and run both the **Kriterion Grading System** (Python backend + Next.js frontend) and **Java applications** in your workspace.

## Prerequisites Check

Your system has the following tools installed:

- ✅ **Java 19** (OpenJDK) - for running Java assignments
- ✅ **Python 3.12.3** - for backend API
- ✅ **Node.js v22.12.0** - for frontend
- ✅ **npm 10.9.0** - for frontend dependencies
- ✅ **macOS** - your operating system

## Part 1: Backend Setup (Python + FastAPI)

### 1. Install Backend Dependencies

```bash
cd /Users/abhishekamgain/Desktop/Kriterion/backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Setup Database (if needed)

```bash
# Run migrations
alembic upgrade head

# Or reset database
bash /Users/abhishekamgain/Desktop/Kriterion/scripts/reset-db-and-migrate.sh
```

### 3. Start Backend Server

```bash
cd /Users/abhishekamgain/Desktop/Kriterion/backend
source venv/bin/activate

# Run FastAPI server
python -m uvicorn app.main:app --reload --port 8000
```

The backend will be available at `http://localhost:8000`

## Part 2: Frontend Setup (Next.js)

### 1. Install Frontend Dependencies

```bash
cd /Users/abhishekamgain/Desktop/Kriterion/frontend

npm install
```

### 2. Configure Environment

Create `.env.local` in the `frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Start Frontend Server

```bash
cd /Users/abhishekamgain/Desktop/Kriterion/frontend

# Development mode
npm run dev

# Build for production
npm run build
npm start
```

The frontend will be available at `http://localhost:3000`

## Part 3: Java Setup & Testing

### Current Java Installation

- **Version**: OpenJDK 19
- **Location**: `/usr/libexec/java_home` (macOS standard location)

### Running Java Code

#### Compile Java Files

```bash
find . -name "*.java" -type f | xargs javac
```

#### Run Java Code

```bash
java -cp /path/to/compiled/classes ClassName
```

#### Run Java Simple Programs

```bash
# Compile single file
javac HelloWorld.java

# Run
java HelloWorld
```

### Java for Grading System

If the Kriterion system supports Java assignments in the backend configuration, Java will be automatically executed in the sandbox when students submit `.java` files.

## Running Everything Together

### Quick Start (All Services)

Use this script to start everything:

```bash
#!/bin/bash

# Start backend
echo "Starting backend..."
cd /Users/abhishekamgain/Desktop/Kriterion/backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend..."
cd /Users/abhishekamgain/Desktop/Kriterion/frontend
npm run dev &
FRONTEND_PID=$!

echo "✅ Backend running on http://localhost:8000"
echo "✅ Frontend running on http://localhost:3000"
echo "✅ Java compiler (javac) ready"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
```

Save this as `run-all.sh` and make it executable:

```bash
chmod +x run-all.sh
./run-all.sh
```

## Troubleshooting

### Java "command not found"

**Solution**: Ensure Java is in your PATH

```bash
# Check Java is installed
java -version

# If not found, add to your shell profile ~/.zshrc or ~/.bash_profile:
export PATH="/usr/libexec/java_home -v 19:$PATH"
```

### Python ModuleNotFoundError

**Solution**: Activate virtual environment first

```bash
source /Users/abhishekamgain/Desktop/Kriterion/backend/venv/bin/activate
```

### Port Already in Use

**Solution**: Kill the process using the port

```bash
# For port 8000 (backend)
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# For port 3000 (frontend)
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Frontend Can't Connect to Backend

**Solution**: Check CORS settings in backend and ensure:

1. Backend is running on `http://localhost:8000`
2. Frontend `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`
3. Backend has CORS enabled for `localhost:3000`

## Supported Languages

Kriterion supports multiple programming languages for assignments:

- 🐍 **Python**
- ☕ **Java**
- And others configured by administrators

## Useful Commands

```bash
# Check all processes on macOS
ps aux | grep -E "python|node|java"

# View backend logs
tail -f /path/to/backend/logs

# View frontend build updates
npm run dev (watch mode)

# Reset everything from scratch
rm -rf venv node_modules
bash scripts/reset-db-and-migrate.sh
```

## Development Tips

1. **Hot Reload**: Both backend and frontend support hot reload during development
2. **Database**: Check `backend/alembic/versions/` for schema migrations
3. **API Documentation**: Visit `http://localhost:8000/docs` for interactive Swagger docs
4. **TypeScript**: Frontend is fully typed with TypeScript

## Next Steps

1. ✅ Verify all tools are installed (check above)
2. ✅ Start backend: `python -m uvicorn app.main:app --reload`
3. ✅ Start frontend: `npm run dev`
4. ✅ Open `http://localhost:3000` in your browser
5. ✅ Java will be available for any assignments that use it

---

Need help? Check the README.md and project documentation for more details.
