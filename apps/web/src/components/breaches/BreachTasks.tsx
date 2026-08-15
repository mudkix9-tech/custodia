import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';

export default function BreachTasks({ breachId }: { breachId: string }) {
  const { data: tasks, isLoading, refetch } = trpc.breaches.tasks.list.useQuery({ breachId });
  const createTask = trpc.breaches.tasks.create.useMutation({ onSuccess: () => refetch() });
  const utils = trpc.useUtils();
  const updateTask = trpc.breaches.tasks.update.useMutation({
    onMutate: async (newUpdate) => {
      await utils.breaches.tasks.list.cancel({ breachId });
      const previousTasks = utils.breaches.tasks.list.getData({ breachId });
      if (previousTasks) {
        utils.breaches.tasks.list.setData({ breachId }, previousTasks.map((t: any) =>
          t.id === newUpdate.id ? { ...t, ...newUpdate } : t
        ) as any);
      }
      return { previousTasks };
    },
    onError: (err, newUpdate, context) => {
      if (context?.previousTasks) {
        utils.breaches.tasks.list.setData({ breachId }, context.previousTasks);
      }
    },
    onSettled: () => {
      utils.breaches.tasks.list.invalidate({ breachId });
    }
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');

  if (isLoading) return <div className="animate-pulse h-32 bg-white/10 rounded-lg"></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-[#F4F5F6]">Remediation & Containment Tasks</h3>
        <p className="text-sm text-[#9BA1A6] mt-1">Track tasks required to secure systems and prevent further exposure.</p>
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="New task title (e.g. Reset compromised passwords)"
          className="flex-1 rounded-md border-white/10 shadow-panel-elevated focus:border-red-500 focus:ring-red-500 sm:text-sm"
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && newTaskTitle.trim()) {
              createTask.mutate({ breachId, title: newTaskTitle });
              setNewTaskTitle('');
            }
          }}
        />
        <button 
          onClick={() => {
            if (newTaskTitle.trim()) {
              createTask.mutate({ breachId, title: newTaskTitle });
              setNewTaskTitle('');
            }
          }}
          disabled={createTask.isPending || !newTaskTitle.trim()}
          className="px-4 py-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-sm font-medium rounded-md shadow-panel-elevated disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <div className="space-y-3 mt-4">
        {tasks?.length === 0 && <p className="text-sm text-[#9BA1A6] text-center py-4 border border-dashed rounded-lg">No tasks added yet.</p>}
        {tasks?.map((task: any) => (
          <div key={task.id} className={`p-4 rounded-lg border flex items-start gap-4 ${task.status === 'completed' ? 'bg-[#08090A] border-white/10 opacity-75' : 'bg-[#0D0F11] border-white/10 shadow-panel-elevated'}`}>
            <input 
              type="checkbox" 
              className="mt-1 h-5 w-5 text-red-400 rounded border-white/10 focus:ring-red-500 cursor-pointer"
              checked={task.status === 'completed'}
              onChange={e => updateTask.mutate({ id: task.id, status: e.target.checked ? 'completed' : 'pending' })}
            />
            <div className="flex-1">
              <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-[#9BA1A6]' : 'text-[#F4F5F6]'}`}>{task.title}</p>
              {task.description && <p className="text-xs text-[#9BA1A6] mt-1">{task.description}</p>}
            </div>
            {task.priority === 'high' && <span className="px-2 py-1 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase rounded">High</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
