FROM nginx:1.27-alpine

# Static single-file game: no build step, no backend, zero runtime dependencies.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 6666
