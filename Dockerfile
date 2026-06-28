# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# Install nginx
RUN apk add --no-cache nginx

# Copy built frontend
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy server and install production deps
COPY server/ ./server/
COPY package.json ./
RUN npm install --omit=dev

# Start script: run nginx + node API server
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 80

CMD ["/app/start.sh"]
