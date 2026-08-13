--
-- PostgreSQL database dump
--

\restrict cAUdvD372XFAGYTamWePAspPoghk9XUWbDs8GgTR0keE0W9RnnzZwz5N0isPfkr

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: birthday_post_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.birthday_post_log (
    year integer NOT NULL,
    month integer NOT NULL,
    post_id bigint,
    count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversation (
    id bigint NOT NULL,
    kind text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    dm_key text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_conversation_kind_check CHECK ((kind = ANY (ARRAY['dm'::text, 'group'::text])))
);


--
-- Name: chat_conversation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_conversation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_conversation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_conversation_id_seq OWNED BY public.chat_conversation.id;


--
-- Name: chat_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_member (
    conv_id bigint NOT NULL,
    username text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_at timestamp with time zone DEFAULT to_timestamp((0)::double precision) NOT NULL
);


--
-- Name: chat_message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_message (
    id bigint NOT NULL,
    conv_id bigint NOT NULL,
    sender text NOT NULL,
    sender_name text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    image text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted boolean DEFAULT false NOT NULL
);


--
-- Name: chat_message_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_message_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_message_id_seq OWNED BY public.chat_message.id;


--
-- Name: chat_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_presence (
    username text NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_ws_ticket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_ws_ticket (
    token text NOT NULL,
    username text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content (
    module text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: content_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_history (
    id bigint NOT NULL,
    module text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by text
);


--
-- Name: content_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.content_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: content_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.content_history_id_seq OWNED BY public.content_history.id;


--
-- Name: employee_birthday; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_birthday (
    emp_key text NOT NULL,
    full_name text NOT NULL,
    birth_day smallint NOT NULL,
    birth_month smallint NOT NULL,
    department text,
    active boolean DEFAULT true NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_birthday_birth_day_check CHECK (((birth_day >= 1) AND (birth_day <= 31))),
    CONSTRAINT employee_birthday_birth_month_check CHECK (((birth_month >= 1) AND (birth_month <= 12)))
);


--
-- Name: news_comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_comment (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    parent_id bigint,
    author text NOT NULL,
    author_name text DEFAULT ''::text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    deleted boolean DEFAULT false NOT NULL
);


--
-- Name: news_comment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.news_comment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: news_comment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.news_comment_id_seq OWNED BY public.news_comment.id;


--
-- Name: news_notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_notification (
    id bigint NOT NULL,
    recipient text NOT NULL,
    type text NOT NULL,
    actor text NOT NULL,
    actor_name text DEFAULT ''::text NOT NULL,
    post_id bigint,
    comment_id bigint,
    snippet text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    count integer DEFAULT 1 NOT NULL,
    url text DEFAULT ''::text NOT NULL,
    wall_post_id bigint
);


--
-- Name: news_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.news_notification_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: news_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.news_notification_id_seq OWNED BY public.news_notification.id;


--
-- Name: news_poll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_poll (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    question text DEFAULT ''::text NOT NULL,
    multi boolean DEFAULT false NOT NULL,
    allow_add boolean DEFAULT false NOT NULL,
    anonymous boolean DEFAULT false NOT NULL,
    closes_at timestamp with time zone
);


--
-- Name: news_poll_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.news_poll_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: news_poll_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.news_poll_id_seq OWNED BY public.news_poll.id;


--
-- Name: news_poll_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_poll_option (
    id bigint NOT NULL,
    poll_id bigint NOT NULL,
    label text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    added_by text,
    added_name text
);


--
-- Name: news_poll_option_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.news_poll_option_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: news_poll_option_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.news_poll_option_id_seq OWNED BY public.news_poll_option.id;


--
-- Name: news_poll_vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_poll_vote (
    poll_id bigint NOT NULL,
    option_id bigint NOT NULL,
    username text NOT NULL,
    name text
);


--
-- Name: news_post; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_post (
    id bigint NOT NULL,
    title_vi text NOT NULL,
    title_en text DEFAULT ''::text NOT NULL,
    summary_vi text DEFAULT ''::text NOT NULL,
    summary_en text DEFAULT ''::text NOT NULL,
    body_vi text DEFAULT ''::text NOT NULL,
    body_en text DEFAULT ''::text NOT NULL,
    cover text DEFAULT ''::text NOT NULL,
    category text DEFAULT 'announcement'::text NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    author text NOT NULL,
    author_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    comments_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: news_post_body_backup_20260811; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_post_body_backup_20260811 (
    id bigint,
    body_vi text,
    body_en text,
    at timestamp with time zone
);


--
-- Name: news_post_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_post_history (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    snapshot jsonb NOT NULL,
    changed_by text DEFAULT ''::text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: news_post_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.news_post_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: news_post_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.news_post_history_id_seq OWNED BY public.news_post_history.id;


--
-- Name: news_post_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.news_post_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: news_post_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.news_post_id_seq OWNED BY public.news_post.id;


--
-- Name: news_reaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_reaction (
    post_id bigint NOT NULL,
    username text NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text DEFAULT ''::text NOT NULL
);


--
-- Name: news_seen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_seen (
    username text NOT NULL,
    seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: news_view; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_view (
    post_id bigint NOT NULL,
    username text NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscription (
    endpoint text NOT NULL,
    username text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profile (
    username text NOT NULL,
    headline text DEFAULT ''::text NOT NULL,
    bio text DEFAULT ''::text NOT NULL,
    avatar text DEFAULT ''::text NOT NULL,
    cover text DEFAULT ''::text NOT NULL,
    accent text DEFAULT ''::text NOT NULL,
    interests jsonb DEFAULT '[]'::jsonb NOT NULL,
    workit_key text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wall_comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wall_comment (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    author text NOT NULL,
    author_name text DEFAULT ''::text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    deleted boolean DEFAULT false NOT NULL
);


--
-- Name: wall_comment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wall_comment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wall_comment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wall_comment_id_seq OWNED BY public.wall_comment.id;


--
-- Name: wall_post; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wall_post (
    id bigint NOT NULL,
    owner text NOT NULL,
    author text NOT NULL,
    author_name text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    image text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    deleted boolean DEFAULT false NOT NULL
);


--
-- Name: wall_post_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wall_post_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wall_post_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wall_post_id_seq OWNED BY public.wall_post.id;


--
-- Name: wall_reaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wall_reaction (
    post_id bigint NOT NULL,
    username text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_conversation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversation ALTER COLUMN id SET DEFAULT nextval('public.chat_conversation_id_seq'::regclass);


--
-- Name: chat_message id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message ALTER COLUMN id SET DEFAULT nextval('public.chat_message_id_seq'::regclass);


--
-- Name: content_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_history ALTER COLUMN id SET DEFAULT nextval('public.content_history_id_seq'::regclass);


--
-- Name: news_comment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comment ALTER COLUMN id SET DEFAULT nextval('public.news_comment_id_seq'::regclass);


--
-- Name: news_notification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_notification ALTER COLUMN id SET DEFAULT nextval('public.news_notification_id_seq'::regclass);


--
-- Name: news_poll id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_poll ALTER COLUMN id SET DEFAULT nextval('public.news_poll_id_seq'::regclass);


--
-- Name: news_poll_option id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_poll_option ALTER COLUMN id SET DEFAULT nextval('public.news_poll_option_id_seq'::regclass);


--
-- Name: news_post id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_post ALTER COLUMN id SET DEFAULT nextval('public.news_post_id_seq'::regclass);


--
-- Name: news_post_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_post_history ALTER COLUMN id SET DEFAULT nextval('public.news_post_history_id_seq'::regclass);


--
-- Name: wall_comment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wall_comment ALTER COLUMN id SET DEFAULT nextval('public.wall_comment_id_seq'::regclass);


--
-- Name: wall_post id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wall_post ALTER COLUMN id SET DEFAULT nextval('public.wall_post_id_seq'::regclass);


--
-- Name: birthday_post_log birthday_post_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_post_log
    ADD CONSTRAINT birthday_post_log_pkey PRIMARY KEY (year, month);


--
-- Name: chat_conversation chat_conversation_dm_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversation
    ADD CONSTRAINT chat_conversation_dm_key_key UNIQUE (dm_key);


--
-- Name: chat_conversation chat_conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversation
    ADD CONSTRAINT chat_conversation_pkey PRIMARY KEY (id);


--
-- Name: chat_member chat_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_member
    ADD CONSTRAINT chat_member_pkey PRIMARY KEY (conv_id, username);


--
-- Name: chat_message chat_message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message
    ADD CONSTRAINT chat_message_pkey PRIMARY KEY (id);


--
-- Name: chat_presence chat_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_presence
    ADD CONSTRAINT chat_presence_pkey PRIMARY KEY (username);


--
-- Name: chat_ws_ticket chat_ws_ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_ws_ticket
    ADD CONSTRAINT chat_ws_ticket_pkey PRIMARY KEY (token);


--
-- Name: content_history content_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_history
    ADD CONSTRAINT content_history_pkey PRIMARY KEY (id);


--
-- Name: content content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_pkey PRIMARY KEY (module, key);


--
-- Name: employee_birthday employee_birthday_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_birthday
    ADD CONSTRAINT employee_birthday_pkey PRIMARY KEY (emp_key);


--
-- Name: news_comment news_comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comment
    ADD CONSTRAINT news_comment_pkey PRIMARY KEY (id);


--
-- Name: news_notification news_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_notification
    ADD CONSTRAINT news_notification_pkey PRIMARY KEY (id);


--
-- Name: news_poll_option news_poll_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_poll_option
    ADD CONSTRAINT news_poll_option_pkey PRIMARY KEY (id);


--
-- Name: news_poll news_poll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_poll
    ADD CONSTRAINT news_poll_pkey PRIMARY KEY (id);


--
-- Name: news_poll_vote news_poll_vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_poll_vote
    ADD CONSTRAINT news_poll_vote_pkey PRIMARY KEY (poll_id, option_id, username);


--
-- Name: news_post_history news_post_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_post_history
    ADD CONSTRAINT news_post_history_pkey PRIMARY KEY (id);


--
-- Name: news_post news_post_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_post
    ADD CONSTRAINT news_post_pkey PRIMARY KEY (id);


--
-- Name: news_reaction news_reaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_reaction
    ADD CONSTRAINT news_reaction_pkey PRIMARY KEY (post_id, username);


--
-- Name: news_seen news_seen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_seen
    ADD CONSTRAINT news_seen_pkey PRIMARY KEY (username);


--
-- Name: news_view news_view_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_view
    ADD CONSTRAINT news_view_pkey PRIMARY KEY (post_id, username);


--
-- Name: push_subscription push_subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscription
    ADD CONSTRAINT push_subscription_pkey PRIMARY KEY (endpoint);


--
-- Name: user_profile user_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_pkey PRIMARY KEY (username);


--
-- Name: wall_comment wall_comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wall_comment
    ADD CONSTRAINT wall_comment_pkey PRIMARY KEY (id);


--
-- Name: wall_post wall_post_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wall_post
    ADD CONSTRAINT wall_post_pkey PRIMARY KEY (id);


--
-- Name: wall_reaction wall_reaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wall_reaction
    ADD CONSTRAINT wall_reaction_pkey PRIMARY KEY (post_id, username);


--
-- Name: chat_member_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_member_user_idx ON public.chat_member USING btree (username);


--
-- Name: chat_message_conv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_message_conv_idx ON public.chat_message USING btree (conv_id, id DESC);


--
-- Name: content_history_mk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_history_mk ON public.content_history USING btree (module, key, changed_at DESC);


--
-- Name: employee_birthday_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_birthday_month_idx ON public.employee_birthday USING btree (birth_month) WHERE active;


--
-- Name: news_comment_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX news_comment_post_idx ON public.news_comment USING btree (post_id, created_at);


--
-- Name: news_notif_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX news_notif_recipient_idx ON public.news_notification USING btree (recipient, created_at DESC);


--
-- Name: news_post_feed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX news_post_feed_idx ON public.news_post USING btree (status, pinned DESC, COALESCE(published_at, created_at) DESC);


--
-- Name: push_sub_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_sub_user_idx ON public.push_subscription USING btree (username);


--
-- Name: user_profile_avatar_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_profile_avatar_idx ON public.user_profile USING btree (username) WHERE (avatar <> ''::text);


--
-- Name: wall_comment_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wall_comment_post_idx ON public.wall_comment USING btree (post_id, created_at);


--
-- Name: wall_post_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wall_post_owner_idx ON public.wall_post USING btree (owner, created_at DESC) WHERE (deleted = false);


--
-- Name: chat_member chat_member_conv_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_member
    ADD CONSTRAINT chat_member_conv_id_fkey FOREIGN KEY (conv_id) REFERENCES public.chat_conversation(id) ON DELETE CASCADE;


--
-- Name: chat_message chat_message_conv_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message
    ADD CONSTRAINT chat_message_conv_id_fkey FOREIGN KEY (conv_id) REFERENCES public.chat_conversation(id) ON DELETE CASCADE;


--
-- Name: news_comment news_comment_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comment
    ADD CONSTRAINT news_comment_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.news_comment(id) ON DELETE CASCADE;


--
-- Name: news_comment news_comment_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comment
    ADD CONSTRAINT news_comment_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.news_post(id) ON DELETE CASCADE;


--
-- Name: news_notification news_notification_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_notification
    ADD CONSTRAINT news_notification_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.news_post(id) ON DELETE CASCADE;


--
-- Name: news_notification news_notification_wall_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_notification
    ADD CONSTRAINT news_notification_wall_post_id_fkey FOREIGN KEY (wall_post_id) REFERENCES public.wall_post(id) ON DELETE CASCADE;


--
-- Name: news_poll_option news_poll_option_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_poll_option
    ADD CONSTRAINT news_poll_option_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.news_poll(id) ON DELETE CASCADE;


--
-- Name: news_poll news_poll_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_poll
    ADD CONSTRAINT news_poll_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.news_post(id) ON DELETE CASCADE;


--
-- Name: news_poll_vote news_poll_vote_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_poll_vote
    ADD CONSTRAINT news_poll_vote_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.news_poll_option(id) ON DELETE CASCADE;


--
-- Name: news_poll_vote news_poll_vote_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_poll_vote
    ADD CONSTRAINT news_poll_vote_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.news_poll(id) ON DELETE CASCADE;


--
-- Name: news_reaction news_reaction_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_reaction
    ADD CONSTRAINT news_reaction_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.news_post(id) ON DELETE CASCADE;


--
-- Name: news_view news_view_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_view
    ADD CONSTRAINT news_view_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.news_post(id) ON DELETE CASCADE;


--
-- Name: wall_comment wall_comment_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wall_comment
    ADD CONSTRAINT wall_comment_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.wall_post(id) ON DELETE CASCADE;


--
-- Name: wall_reaction wall_reaction_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wall_reaction
    ADD CONSTRAINT wall_reaction_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.wall_post(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict cAUdvD372XFAGYTamWePAspPoghk9XUWbDs8GgTR0keE0W9RnnzZwz5N0isPfkr

