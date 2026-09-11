# Fast, ultra-lightweight Nginx container
FROM docker.io/library/nginx:alpine

# Copy pre-built production assets from dist/
COPY dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
