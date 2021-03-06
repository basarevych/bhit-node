# Interconnect Tracker

See https://github.com/breedhub/interconnect

# Installation

## PostgreSQL and Redis

Install PostgreSQL 9.4+. Debian example:

```
# apt-get install postgresql postgresql-client
```

Install Redis 3.0+. Debian example:

Jessie:

```
# wget https://www.dotdeb.org/dotdeb.gpg
# apt-key add dotdeb.gpg
# echo "deb http://packages.dotdeb.org jessie all" >> /etc/apt/sources.list
# apt-get update
```

Now Jessie and Stretch:

```
# apt-get install redis-server
```

## Install bhit

Debian:

```
# curl -s http://tracker.breedhub.net/bhit/install.sh | sh -s
```

Manually:

* Install Node 8 and system build tools
* Run **npm install -g bhit --unsafe-perm**

## Prepare and start

Replace 1.2.3.4 with your IP address. You can also any hostname here. The tracker
will be known to daemons by this address or name.

```
# cd /
# bhitctl install 1.2.3.4
# sudo -u postgres bhitctl create-db
# bhitctl migrate-db
# systemctl enable bhit
# systemctl start bhit
```

## Private tracker

You can limit who can use your tracker by whitelisting their emails:

```
[tracker]
allow_users[] = user1@example.com
allow_users[] = user2@example.com
allow_users[] = user3@example.com
```
