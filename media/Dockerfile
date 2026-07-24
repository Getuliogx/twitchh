FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx libnginx-mod-rtmp ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /hls /run/nginx \
  && chown -R www-data:www-data /hls \
  && chmod 755 /hls
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80 1935
CMD ["nginx", "-g", "daemon off;"]
