FROM node:24
WORKDIR /status
COPY --chown=node:node status.mjs server.mjs style.css public-status.json ./
USER node
ENV HOST=0.0.0.0 PORT=8091
EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8091/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
