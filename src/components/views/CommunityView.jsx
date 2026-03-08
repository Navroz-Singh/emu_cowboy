"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useArcadeStore } from "@/store/arcadeStore";
import { GAMES } from "@/utils/constants";

export default function CommunityView({ user }) {
  const openAuthModal = useArcadeStore((state) => state.openAuthModal);

  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedGameId, setSelectedGameId] = useState("");
  const [postGameId, setPostGameId] = useState(GAMES[0]?.id || "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});

  const gameLabelMap = useMemo(
    () => new Map(GAMES.map((game) => [game.id, game.title])),
    [],
  );

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();
      if (selectedGameId) query.set("gameId", selectedGameId);
      const response = await fetch(`/api/v1/community/posts?${query.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Unable to load community posts.");
      }

      setPosts(Array.isArray(payload.posts) ? payload.posts : []);
    } catch (fetchError) {
      setPosts([]);
      setError(fetchError?.message || "Unable to load community posts.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedGameId, posts.length]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const requireAuth = () => {
    if (user) return true;
    openAuthModal("login");
    return false;
  };

  const submitPost = async () => {
    if (!requireAuth() || isSubmitting) return;
    if (title.trim().length < 3 || content.trim().length < 3 || !postGameId) return;

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: postGameId, title, content }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Unable to create post.");
      }

      setTitle("");
      setContent("");
      await loadPosts();
    } catch (submitError) {
      setError(submitError?.message || "Unable to create post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReaction = async (postId, value) => {
    if (!requireAuth()) return;

    const response = await fetch(`/api/v1/community/posts/${postId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      setError(payload?.error || "Unable to update reaction.");
      return;
    }

    setPosts((current) => current.map((post) => {
      if (post.id !== postId) return post;
      return {
        ...post,
        likesCount: payload.likesCount,
        dislikesCount: payload.dislikesCount,
      };
    }));
  };

  const submitComment = async (postId) => {
    if (!requireAuth()) return;

    const draft = String(commentDrafts[postId] || "").trim();
    if (!draft) return;

    const response = await fetch(`/api/v1/community/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      setError(payload?.error || "Unable to add comment.");
      return;
    }

    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    setPosts((current) => current.map((post) => {
      if (post.id !== postId) return post;
      return {
        ...post,
        commentsCount: Number(post.commentsCount || 0) + 1,
        comments: [...(Array.isArray(post.comments) ? post.comments : []), payload.comment],
      };
    }));
  };

  return (
    <section className="grid h-full grid-cols-1 gap-3 md:grid-cols-[34%_66%]">
      <div className="arcade-border flex min-h-0 flex-col gap-2 bg-(--cabinet-tan)/35 p-3 text-[10px] md:text-xs">
        <h3 className="saloon-title text-lg text-(--title-red)">FORUM DISCUSSIONS</h3>

        <label className="arcade-border flex items-center gap-2 bg-background px-2 py-1">
          <span>FILTER:</span>
          <select className="w-full bg-transparent" value={selectedGameId} onChange={(event) => setSelectedGameId(event.target.value)}>
            <option value="">ALL GAMES</option>
            {GAMES.map((game) => (
              <option key={game.id} value={game.id}>{game.title.toUpperCase()}</option>
            ))}
          </select>
        </label>

        <div className="arcade-border flex flex-col gap-2 bg-(--screen-bg)/55 p-2">
          <p className="text-[9px] md:text-[10px]">NEW POST</p>
          <select className="arcade-border bg-background px-2 py-1" value={postGameId} onChange={(event) => setPostGameId(event.target.value)}>
            {GAMES.map((game) => (
              <option key={game.id} value={game.id}>{game.title.toUpperCase()}</option>
            ))}
          </select>
          <input
            className="arcade-border bg-background px-2 py-1"
            maxLength={140}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Post title"
            value={title}
          />
          <textarea
            className="arcade-border min-h-24 resize-none bg-background px-2 py-1"
            maxLength={4000}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write your post"
            value={content}
          />
          <button className="pixel-button px-3 py-2" disabled={isSubmitting} onClick={submitPost} type="button">
            {isSubmitting ? "POSTING..." : "CREATE POST"}
          </button>
        </div>

        {error ? <p className="text-(--title-red)">{error}</p> : null}
        {!user ? <p className="text-[9px] md:text-[10px]">LOG IN TO POST, COMMENT, AND REACT.</p> : null}
      </div>

      <div className="arcade-border min-h-0 overflow-y-auto bg-(--cabinet-tan)/30 p-3 text-[10px] md:text-xs">
        {isLoading ? <p className="loading-blink">LOADING DISCUSSIONS...</p> : null}
        {!isLoading && posts.length === 0 ? <p>NO POSTS YET. START THE DISCUSSION.</p> : null}

        <div className="space-y-3">
          {posts.map((post) => (
            <article key={post.id} className="arcade-border bg-(--screen-bg)/65 p-2">
              <p className="text-[9px] text-(--accent-gold)">{(gameLabelMap.get(post.gameId) || post.gameId || "UNKNOWN").toUpperCase()}</p>
              <h4 className="mt-1 text-xs md:text-sm">{String(post.title || "").toUpperCase()}</h4>
              <p className="mt-1 whitespace-pre-wrap">{post.content}</p>
              <p className="mt-2 text-[9px]">BY {(post.author?.name || "UNKNOWN").toUpperCase()}</p>

              <div className="mt-2 flex flex-wrap gap-2">
                <button className="arcade-border bg-background px-2 py-1" onClick={() => submitReaction(post.id, "like")} type="button">
                  👍 {Number(post.likesCount || 0)}
                </button>
                <button className="arcade-border bg-background px-2 py-1" onClick={() => submitReaction(post.id, "dislike")} type="button">
                  👎 {Number(post.dislikesCount || 0)}
                </button>
                <span className="arcade-border bg-background px-2 py-1">COMMENTS {Number(post.commentsCount || 0)}</span>
              </div>

              <div className="mt-2 space-y-1">
                {(Array.isArray(post.comments) ? post.comments : []).map((comment) => (
                  <div key={comment.id} className="arcade-border bg-background/70 px-2 py-1">
                    <p className="text-[9px]">{(comment.author?.name || "UNKNOWN").toUpperCase()}</p>
                    <p>{comment.content}</p>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  className="arcade-border w-full bg-background px-2 py-1"
                  maxLength={1200}
                  onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                  placeholder="Add a comment"
                  value={commentDrafts[post.id] || ""}
                />
                <button className="pixel-button px-3 py-1" onClick={() => submitComment(post.id)} type="button">
                  COMMENT
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
