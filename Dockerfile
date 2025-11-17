# Stage 1: Build the React app
FROM node:16-alpine as build

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (ignore package-lock.json to avoid conflicts)
# Install ajv first to resolve dependency conflicts
RUN rm -f package-lock.json && \
    npm install ajv@^8.12.0 --legacy-peer-deps && \
    npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build argument for API URL
ARG REACT_APP_API_URL=http://192.168.100.124:3001
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build the app
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

