--
-- Sample pg_dump-style SQL for local testing
--

SET statement_timeout = 0;
SET lock_timeout = 0;

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone
);

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id integer NOT NULL,
    total numeric(10,2),
  status text
);

COPY public.users (id, email, is_active, created_at) FROM stdin;
1	admin@example.com	t	2024-01-15 10:00:00
2	guest@example.com	f	2024-02-20 14:30:00
3	\N	f	\N
\.

COPY public.orders (id, user_id, total, status) FROM stdin;
100	1	49.99	completed
101	1	12.50	pending
102	2	0.00	cancelled
\.

INSERT INTO public.users (id, email, is_active, created_at) VALUES (4, 'legacy@example.com', true, '2024-03-01 08:00:00');
