# ============================================================
#  Stage 1 — Build the Vite + React application
# ============================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package manifests first (Docker layer caching)
COPY package.json package-lock.json ./

# Clean install — deterministic, reproducible
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the production bundle
RUN npm run build

# ============================================================
#  Stage 2 — Serve with Nginx
# ============================================================
FROM nginx:alpine AS production

# Remove the default Nginx site
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
