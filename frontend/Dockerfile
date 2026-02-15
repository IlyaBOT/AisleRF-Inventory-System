# ---------- Dependencies (cached) ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only dependency manifests first for better layer caching.
# package-lock.json is optional (pattern won't fail if absent).
COPY package*.json ./

# Install deps. Prefer reproducible installs when lockfile exists.
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_LOGLEVEL=info

RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi


# ---------- Dev ----------
FROM node:20-alpine AS dev
WORKDIR /app

ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_LOGLEVEL=info

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json vite.config.ts ./
COPY index.html ./
COPY src ./src
COPY public ./public

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]


# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE=/api
ARG VITE_APP_MODE=prod
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_APP_MODE=$VITE_APP_MODE \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_LOGLEVEL=info

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json vite.config.ts ./
COPY index.html ./
COPY src ./src
COPY public ./public

RUN npm run build


# ---------- Prod (nginx) ----------
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
