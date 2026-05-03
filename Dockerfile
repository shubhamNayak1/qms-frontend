# ===== Build stage =====
FROM node:20-alpine AS build
WORKDIR /app

# CRA bakes env vars at build time
ARG REACT_APP_API_BASE_URL=http://localhost:8080
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ===== Serve stage =====
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
