import { Star, Lock, Globe, Trash2, Pin, CircleDot } from 'lucide-solid';

export const RepoCard = (props) => {
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    props.onDelete?.(props.repo);
  };

  const handlePinClick = (e) => {
    e.stopPropagation();
    props.onPin?.(props.repo);
  };

  return (
    <div
      onClick={() => props.onClick(props.repo)}
      class="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md dark:hover:shadow-slate-900/50 transition-shadow cursor-pointer flex flex-col h-full group"
    >
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 min-w-0 flex-1">
           <Show when={props.repo.private} fallback={<Globe size={16} class="text-slate-400 dark:text-slate-500 flex-shrink-0" />}>
            <Lock size={16} class="text-slate-400 dark:text-slate-500 flex-shrink-0" />
           </Show>
           <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-100 break-all">{props.repo.name}</h3>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <Show when={props.onPin}>
            <button
              onClick={handlePinClick}
              class={`p-1.5 rounded-md transition-all ${
                props.isPinned
                  ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 opacity-0 group-hover:opacity-100'
              }`}
              title={props.isPinned ? "Unpin repository" : "Pin repository"}
            >
              <Pin size={16} />
            </button>
          </Show>
          <Show when={props.onDelete}>
            <button
              onClick={handleDeleteClick}
              class="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md opacity-0 group-hover:opacity-100 transition-all"
              title="Delete repository"
            >
              <Trash2 size={16} />
            </button>
          </Show>
          <span class="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-600">
            {props.repo.language || 'Text'}
          </span>
        </div>
      </div>

      <p class="text-slate-500 dark:text-slate-400 text-sm mb-3 line-clamp-2">
        {props.repo.description || "No description provided."}
      </p>

      <Show when={props.issues && props.issues.length > 0}>
        <div class="mb-3 space-y-1.5">
          <For each={props.issues}>{(issue) =>
            <div
              class="flex items-start gap-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.open(issue.html_url, '_blank');
              }}
            >
              <CircleDot
                size={12}
                class={`mt-0.5 flex-shrink-0 ${issue.state === 'open' ? 'text-green-500' : 'text-purple-500'}`}
              />
              <span class="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate cursor-pointer">
                {issue.title}
              </span>
            </div>
          }</For>
        </div>
      </Show>

      <div class="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
        <div class="flex items-center gap-1">
          <Star size={14} />
          <span>{props.repo.stargazers_count}</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-2 h-2 rounded-full bg-green-500" />
          <span>{new Date(props.repo.updated_at).toLocaleDateString()}</span>
        </div>
        <div class="ml-auto text-xs text-slate-400 dark:text-slate-500">
            {props.repo.open_issues_count} issues
        </div>
      </div>
    </div>
  );
};
