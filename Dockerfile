# Web image: builds the React application and serves it with Nginx, which also proxies /api to the API.
# Build from this folder: docker build -t ug-arms-web .
# Run with API_UPSTREAM set to the API's host:port if it is not reachable as api:4200.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

# Pinned to a current stable release; rebuild regularly so operating-system security fixes are picked up.
FROM nginx:1.30.6-alpine
RUN apk upgrade --no-cache
ENV API_UPSTREAM=api:4200
# The image's entrypoint renders templates into conf.d, substituting only defined environment variables.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
