FROM scratch
COPY --chmod=0755 rootfs/ /
COPY --chmod=0755 server /app/server
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 CMD ["/app/server","--healthcheck"]
ENTRYPOINT ["/app/server"]
