--
-- Common functions
--

CREATE OR REPLACE FUNCTION invalidate_cache(cache_keys text[]) RETURNS VOID AS $$
DECLARE
    row record;
BEGIN
    FOR row IN SELECT DISTINCT unnest(cache_keys) AS name LOOP
        PERFORM pg_notify('invalidate_cache', '{ "key": "sql:' || row.name || '" }');
    END LOOP;
END;
$$ LANGUAGE plpgsql;


--
-- Types
--

CREATE TYPE daemon_type AS ENUM ('server', 'client');


--
-- Info
--

CREATE TABLE _info (
    id bigserial NOT NULL,
    name varchar(255) NULL,
    value json NULL,
    CONSTRAINT _info_pk PRIMARY KEY (id),
    CONSTRAINT _info_unique_name UNIQUE (name)
);

INSERT INTO _info(name, value) VALUES('schema_version', '1'::json);

--
-- Users
--

CREATE TABLE users (
    id bigserial NOT NULL,
    name varchar(255) NULL,
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    confirm varchar(255) NULL,
    password varchar(255) NOT NULL,
    created_at timestamp NOT NULL,
    confirmed_at timestamp NULL,
    blocked_at timestamp NULL,
    CONSTRAINT users_pk PRIMARY KEY (id),
    CONSTRAINT users_unique_email UNIQUE (email),
    CONSTRAINT users_unique_token UNIQUE (token)
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
                'users-by-email:' || NEW.email,
                'users-by-token:' || NEW.token,
                'paths-roots-by-user-id:' || NEW.id
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'users-by-id:' || OLD.id,
                'users-by-email:' || OLD.email,
                'users-by-token:' || OLD.token,
                'paths-roots-by-user-id:' || OLD.id
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
    created_at timestamp NOT NULL,
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
                'connections-by-daemon-id:' || NEW.id
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'daemons-by-id:' || OLD.id,
                'daemons-by-token:' || OLD.token,
                'connections-by-daemon-id:' || OLD.id
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
    user_id bigint NOT NULL,
    name varchar(255) NOT NULL,
    path text NOT NULL,
    token varchar(255) NOT NULL,
    CONSTRAINT paths_pk PRIMARY KEY (id),
    CONSTRAINT paths_unique_path UNIQUE (user_id, path),
    CONSTRAINT paths_unique_token UNIQUE (token),
    CONSTRAINT paths_parent_fk FOREIGN KEY(parent_id)
        REFERENCES paths(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT paths_user_fk FOREIGN KEY(user_id)
        REFERENCES users(id)
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
                'paths-by-token:' || NEW.token,
                'paths-by-user-id-and-path:' || NEW.user_id || ':' || NEW.path,
                'paths-roots-by-user-id:' || NEW.user_id
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'paths-by-id:' || OLD.id,
                'paths-by-token:' || OLD.token,
                'paths-by-user-id-and-path:' || OLD.user_id || ':' || OLD.path,
                'paths-roots-by-user-id:' || OLD.user_id
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
    fixed boolean NOT NULL,
    connect_address varchar(255) NULL,
    connect_port varchar(255) NOT NULL,
    listen_address varchar(255) NULL,
    listen_port varchar(255) NULL,
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
                'daemons-by-connection-id:' || NEW.id
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'connections-by-id:' || OLD.id,
                'daemons-by-connection-id:' || OLD.id
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
    address_override varchar(255) NULL,
    port_override varchar(255) NULL,
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
                'connections-by-daemon-id:' || NEW.daemon_id,
                'daemons-by-connection-id:' || NEW.connection_id
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'connections-by-daemon-id:' || OLD.daemon_id,
                'daemons-by-connection-id:' || OLD.connection_id
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
