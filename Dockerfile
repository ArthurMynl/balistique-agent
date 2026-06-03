FROM oven/bun:1.2-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

COPY mail/ mail/
COPY src/ src/
COPY tsconfig.json ./

ENV HOME=/data
ENV BALISTIQUE_STATE_DIR=/data

VOLUME ["/data"]

CMD ["bun", "run", "src/index.ts"]
