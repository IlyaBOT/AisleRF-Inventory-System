FROM node:20-alpine AS base
WORKDIR /app
COPY package.json tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public

# Dev
FROM base AS dev
RUN npm install
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# Build
FROM base AS build
ARG VITE_API_BASE=/api
ARG VITE_APP_MODE=prod
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_APP_MODE=$VITE_APP_MODE
RUN npm install
RUN npm run build

# Prod (nginx)
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
