Genera PEM locales con: npm run tls:init
En QA/prod preferir certificados corporativos vía TLS_CERT y TLS_KEY.

CA de salida (SSL Inspection / Forti):
  Coloca el PEM del CA corporativo como certs/corp-ca.pem
  y en .env: NODE_EXTRA_CA_CERTS=/app/certs/corp-ca.pem
  (docker-compose ya monta ./certs). Eso NO desactiva la verificación TLS.
