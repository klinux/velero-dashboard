FROM alpine:3.11 as build

WORKDIR /app

COPY ./src/ /app/

RUN apk update && \
    apk add npm && \
    npm install -g uglifycss uglify-es && \
    chown -R root: * && \
    find ./oauth2/static/js/ -type f \
        -name "*.js" ! -name "*.min.*" ! -name "vfs_fonts*" \
        -exec echo {} \; \
        -exec uglifyjs -c -o {}.min {} \; \
        -exec rm {} \; \
        -exec mv {}.min {} \; && \
    find ./oauth2/static/css/ -type f \
        -name "*.css" ! -name "*.min.*" \
        -exec echo {} \; \
        -exec uglifycss --output {}.min {} \; \
        -exec rm {} \; \
        -exec mv {}.min {} \; && \
    find . -type d -name "__pycache__" \
        -prune -exec rm -rf {} \;

FROM python:alpine3.11 as prod

RUN apk update && \
    apk upgrade && \
    apk add bash && \
    apk add git && \
    apk add gcc && \
    apk add libc-dev && \
    apk add libev-dev

WORKDIR /app

RUN adduser \
    --disabled-password \
    --gecos "app user" \
    --home "/app" \
    --no-create-home \
    "app"

COPY ./src/requirements.txt /app/requirements.txt

RUN pip install -r /app/requirements.txt

RUN chown -R app:app . && \
    apk del git gcc libc-dev

COPY --from=0 /app .
# COPY ./src/ /app/

USER app

# ENTRYPOINT [ "python", "run.py" ]
ENTRYPOINT ["python", "server.py"]
