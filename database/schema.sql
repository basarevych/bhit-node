--
-- Prepare
--

DROP TABLE IF EXISTS daemons CASCADE;
DROP TABLE IF EXISTS users CASCADE;


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
    user_id bigserial NOT NULL,
    name varchar(255) NULL,
    token varchar(255) NOT NULL,
    confirm varchar(255) NULL,
    created_at timestamp NOT NULL,
    confirmed_at timestamp NULL,
    blocked_at timestamp NULL,
    CONSTRAINT daemons_pk PRIMARY KEY (id),
    CONSTRAINT users_unique_name UNIQUE (user_id, name),
    CONSTRAINT users_unique_token UNIQUE (token),
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
                'daemons-by-token:' || NEW.token
            ]
        );
    END IF;
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        cache_keys = array_cat(
            cache_keys,
            array[
                'daemons-by-id:' || OLD.id,
                'daemons-by-token:' || OLD.token
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