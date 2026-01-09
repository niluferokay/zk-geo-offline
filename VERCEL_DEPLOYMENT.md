# Vercel Deployment Guide

This guide explains how to deploy the ZK Location Proof application to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. Git repository pushed to GitHub, GitLab, or Bitbucket
3. Vercel CLI (optional, for command-line deployment)

## Option 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Push to Git Repository

First, commit and push your code:

```bash
git add .
git commit -m "Add Vercel configuration"
git push origin main
```

### Step 2: Import Project to Vercel

1. Go to https://vercel.com/new
2. Click "Import Project"
3. Select your Git repository
4. Vercel will auto-detect the configuration from `vercel.json`
5. Click "Deploy"

The deployment will:
- Install dependencies from `client/package.json`
- Build the project using `npm run build`
- Deploy the static assets from `client/dist`
- Apply the required CORS headers for Web Workers

### Step 3: Access Your Deployment

Once deployed, Vercel will provide:
- Production URL: `https://your-project.vercel.app`
- Preview URLs for each branch/PR
- Automatic SSL certificates

## Option 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

From the project root directory:

```bash
vercel
```

For production deployment:

```bash
vercel --prod
```

## Configuration Details

The project uses these key configurations in `vercel.json`:

### Build Settings
- **Build Command**: `cd client && npm install && npm run build`
- **Output Directory**: `client/dist`
- **Install Command**: `npm install --prefix client`

### Headers
Required for Web Workers and SharedArrayBuffer:
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

## Environment Variables (if needed)

If you need to add environment variables:

1. Go to your project settings in Vercel Dashboard
2. Navigate to "Environment Variables"
3. Add any required variables
4. Redeploy the project

## Troubleshooting

### Build Fails
- Check that all dependencies are in `client/package.json`
- Verify TypeScript compilation works locally: `cd client && npm run build`

### CORS Errors
- Ensure the headers in `vercel.json` are properly applied
- Check browser console for specific CORS messages

### 404 Errors on Routes
- Vercel automatically handles SPA routing for static sites
- If issues persist, add a `rewrites` section to `vercel.json`

## Custom Domain

To add a custom domain:

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Update your DNS records as instructed

## Monitoring

Vercel provides:
- Real-time logs in the dashboard
- Analytics for page views and performance
- Error tracking and alerts

## Updating the Deployment

To deploy updates:

1. Commit and push changes to your Git repository
2. Vercel automatically deploys on push to main branch
3. Preview deployments are created for PRs

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
