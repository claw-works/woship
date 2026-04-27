# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM golang:1.22-alpine AS backend
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN GOPROXY=https://goproxy.cn,direct go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /woship-server ./cmd/server

# Stage 3: Pre-cache terraform providers
FROM alpine:3.19 AS tf-setup
RUN apk --no-cache add curl unzip
ARG TOFU_VERSION=1.9.0
RUN curl -fsSL "https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}/tofu_${TOFU_VERSION}_linux_amd64.zip" -o /tmp/tofu.zip \
    && unzip /tmp/tofu.zip -d /usr/local/bin tofu \
    && chmod +x /usr/local/bin/tofu \
    && rm /tmp/tofu.zip
COPY backend/terraform/templates /tmp/templates
RUN mkdir -p /opt/tf-plugins \
    && for tpl in /tmp/templates/*/; do \
         cd "$tpl" && \
         tofu init -backend=false -input=false -no-color 2>/dev/null; \
         cp -r .terraform/providers/* /opt/tf-plugins/ 2>/dev/null || true; \
         cd /; \
       done

# Stage 4: Final image
FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app

COPY --from=tf-setup /usr/local/bin/tofu /usr/local/bin/tofu
COPY --from=tf-setup /opt/tf-plugins /opt/tf-plugins
RUN printf 'provider_installation {\n  filesystem_mirror {\n    path = "/opt/tf-plugins"\n  }\n}\n' > /root/.tofurc

COPY --from=backend /woship-server /woship-server
COPY backend/migrations ./migrations
COPY backend/terraform/templates ./terraform/templates
COPY --from=frontend /app/dist ./public

ENV WEB_ROOT=/app/public
EXPOSE 8080
CMD ["/woship-server"]
