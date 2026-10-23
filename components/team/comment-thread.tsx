import { Avatar } from "@/components/shared/avatar";
import { CommentForm } from "@/components/team/comment-form";
import { formatDateTime } from "@/lib/dates";
import type { CommentView } from "@/server/queries/team";

export function CommentThread({
  comments,
  entityType,
  entityId,
  people,
  tz,
}: {
  comments: CommentView[];
  entityType: "lead" | "project" | "task";
  entityId: string;
  people: { id: string; name: string }[];
  tz: string;
}) {
  return (
    <div id="comments" className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Notes here replace side texts about the job.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar id={c.author?.id} name={c.author?.name} className="mt-0.5 size-7" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.author?.name ?? "—"}</span> ·{" "}
                  {formatDateTime(c.created_at, tz)}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
                {c.photos.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.photos.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="size-20 rounded-md object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      <CommentForm entityType={entityType} entityId={entityId} people={people} />
    </div>
  );
}
