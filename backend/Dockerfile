FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /woship-server ./cmd/server

# Pre-cache terraform providers
FROM alpine:3.19 AS tf-setup
RUN apk --no-cache add curl unzip
ARG TOFU_VERSION=1.9.0
RUN curl -fsSL "https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}/tofu_${TOFU_VERSION}_linux_amd64.zip" -o /tmp/tofu.zip \
    && unzip /tmp/tofu.zip -d /usr/local/bin tofu \
    && chmod +x /usr/local/bin/tofu \
    && rm /tmp/tofu.zip

# Cache providers by running init on templates
COPY terraform/templates /tmp/templates
RUN mkdir -p /opt/tf-plugins \
    && for tpl in /tmp/templates/*/; do \
         cd "$tpl" && \
         tofu init -backend=false -input=false -no-color 2>/dev/null; \
         cp -r .terraform/providers/* /opt/tf-plugins/ 2>/dev/null || true; \
         cd /; \
       done

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app

# Install tofu
COPY --from=tf-setup /usr/local/bin/tofu /usr/local/bin/tofu

# Provider cache (filesystem_mirror)
COPY --from=tf-setup /opt/tf-plugins /opt/tf-plugins
RUN mkdir -p /root && printf 'provider_installation {\n  filesystem_mirror {\n    path = "/opt/tf-plugins"\n  }\n}\n' > /root/.tofurc

# App
COPY --from=builder /woship-server /woship-server
COPY migrations ./migrations
COPY terraform/templates ./terraform/templates

EXPOSE 8080
CMD ["/woship-server"]
