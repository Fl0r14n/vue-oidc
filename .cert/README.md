# Certificates folder for https development

### Install

```shell
sudo pacman -S mkcert
```

or Ubuntu WSL

```shell
apt install mkcert
```

### Register

```shell
mkcert -uninstall
mkcert -install
```

### How to generate

```shell
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 ::1
chmod 604 *.pem
```

#### Don't forget to symlink to certifi path in python


### Generate certificate for oauth PKCE

```shell
openssl genrsa -out oidc.key 4096
```
