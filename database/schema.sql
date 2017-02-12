--
-- Prepare
--

DROP TABLE IF EXISTS daemon_connections CASCADE;
DROP TABLE IF EXISTS connections CASCADE;
DROP TABLE IF EXISTS paths CASCADE;
DROP TABLE IF EXISTS daemons CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS daemon_type;


--
-- Common functions
--

CREATE OR REPLACE FUNCTION invalidate_cache(cache_keys text[]) RETURNS VOID AS $$
DECLARE
    row record;
BEGIN
    FOR row IN SELECT DISTINCT unnest(cache_keys) AS name LOOP
        PERFORM pg_notify('invalidate_cache', '{ "key": "' || row.name || '" }');
    END LOOP;
END;
$$ LANGUAGE plpgsql;


--
-- Types
--

CREATE TYPE daemon_type AS ENUM ('server', 'client');


--
-- Users
--

CREATE TABLE users (
    id bigserial NOT NULL,
    name varchar(255) NULL,
    email varchar(255) NOT NULL,
    password varchar(255) NOT NULL,
    created_at timestamp NOT NULL,
    blocked_at timestamp NULL,
    CONSTRAINT users_pk PRIMARY KEY (id),
    CONSTRAINT users_unique_email UNIQUE (email)
);

CREATE OR REPLACE FUNCTION invalidate_users_cache() RETURNS trigger AS $$
DECLARE
    cache_keys text[] := array[]::text[];
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'users-by-id:' || NEW.id,
                'users-by-email:' || NEW.email
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'users-by-id:' || OLD.id,
                'users-by-email:' || OLD.email
            ]
        );
    END IF;

    PERFORM invalidate_cache(cache_keys);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invalidate_cache
    AFTER INSERT OR UPDATE OR DELETE
    ON users
    FOR EACH ROW
    EXECUTE PROCEDURE invalidate_users_cache();


--
-- Daemons
--

CREATE TABLE daemons (
    id bigserial NOT NULL,
    user_id bigint NOT NULL,
    name varchar(255) NULL,
    token varchar(255) NOT NULL,
    confirm varchar(255) NULL,
    created_at timestamp NOT NULL,
    confirmed_at timestamp NULL,
    blocked_at timestamp NULL,
    CONSTRAINT daemons_pk PRIMARY KEY (id),
    CONSTRAINT daemons_unique_name UNIQUE (user_id, name),
    CONSTRAINT daemons_unique_token UNIQUE (token),
    CONSTRAINT daemons_user_fk FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION invalidate_daemons_cache() RETURNS trigger AS $$
DECLARE
    cache_keys text[] := array[]::text[];
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'daemons-by-id:' || NEW.id,
                'daemons-by-token:' || NEW.token,
                'daemon-connections-by-daemon-id:' || NEW.id
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'daemons-by-id:' || OLD.id,
                'daemons-by-token:' || OLD.token,
                'daemon-connections-by-daemon-id:' || OLD.id
            ]
        );
    END IF;

    PERFORM invalidate_cache(cache_keys);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invalidate_cache
    AFTER INSERT OR UPDATE OR DELETE
    ON daemons
    FOR EACH ROW
    EXECUTE PROCEDURE invalidate_daemons_cache();


--
-- Paths
--

CREATE TABLE paths (
    id bigserial NOT NULL,
    parent_id bigint NULL,
    name varchar(255) NOT NULL,
    path text NOT NULL,
    token varchar(255) NOT NULL,
    CONSTRAINT paths_pk PRIMARY KEY (id),
    CONSTRAINT paths_unique_path UNIQUE (path),
    CONSTRAINT paths_unique_token UNIQUE (token),
    CONSTRAINT paths_parent_fk FOREIGN KEY(parent_id)
        REFERENCES paths(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION invalidate_paths_cache() RETURNS trigger AS $$
DECLARE
    cache_keys text[] := array[]::text[];
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'paths-by-id:' || NEW.id,
                'paths-by-path:' || NEW.path,
                'paths-by-token:' || NEW.token
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'paths-by-id:' || OLD.id,
                'paths-by-path:' || OLD.path,
                'paths-by-token:' || OLD.token
            ]
        );
    END IF;

    PERFORM invalidate_cache(cache_keys);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invalidate_cache
    AFTER INSERT OR UPDATE OR DELETE
    ON paths
    FOR EACH ROW
    EXECUTE PROCEDURE invalidate_paths_cache();


--
-- Connections
--

CREATE TABLE connections (
    id bigserial NOT NULL,
    user_id bigint NOT NULL,
    path_id bigint NOT NULL,
    token varchar(255) NOT NULL,
    encrypted boolean NOT NULL,
    connect_address varchar(255) NOT NULL,
    connect_port varchar(255) NOT NULL,
    listen_address varchar(255) NOT NULL,
    listen_port varchar(255) NOT NULL,
    CONSTRAINT connections_pk PRIMARY KEY (id),
    CONSTRAINT connections_unique_path UNIQUE (user_id, path_id),
    CONSTRAINT connections_user_fk FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT connections_path_fk FOREIGN KEY(path_id)
        REFERENCES paths(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION invalidate_connections_cache() RETURNS trigger AS $$
DECLARE
    cache_keys text[] := array[]::text[];
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'connections-by-id:' || NEW.id,
                'daemon-connections-by-connection-id:' || NEW.id
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'connections-by-id:' || OLD.id,
                'daemon-connections-by-connection-id:' || OLD.id
            ]
        );
    END IF;

    PERFORM invalidate_cache(cache_keys);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invalidate_cache
    AFTER INSERT OR UPDATE OR DELETE
    ON connections
    FOR EACH ROW
    EXECUTE PROCEDURE invalidate_connections_cache();


--
-- Daemon connections
--

CREATE TABLE daemon_connections (
    id bigserial NOT NULL,
    daemon_id bigint NOT NULL,
    connection_id bigint NOT NULL,
    acting_as daemon_type NOT NULL,
    CONSTRAINT daemon_connections_pk PRIMARY KEY (id),
    CONSTRAINT daemon_connections_daemon_fk FOREIGN KEY(daemon_id)
        REFERENCES daemons(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT daemon_connections_connection_fk FOREIGN KEY(connection_id)
        REFERENCES connections(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION invalidate_daemon_connections_cache() RETURNS trigger AS $$
DECLARE
    cache_keys text[] := array[]::text[];
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'daemon-connections-by-id:' || NEW.id,
                'daemon-connections-by-daemon-id:' || NEW.daemon_id,
                'daemon-connections-by-connection-id:' || NEW.connection_id
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'daemon-connections-by-id:' || OLD.id,
                'daemon-connections-by-daemon-id:' || OLD.daemon_id,
                'daemon-connections-by-connection-id:' || OLD.connection_id
            ]
        );
    END IF;

    PERFORM invalidate_cache(cache_keys);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invalidate_cache
    AFTER INSERT OR UPDATE OR DELETE
    ON daemon_connections
    FOR EACH ROW
    EXECUTE PROCEDURE invalidate_daemon_connections_cache();
