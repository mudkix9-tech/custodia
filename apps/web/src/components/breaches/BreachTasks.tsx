// @ts-nocheck
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
        utils.breaches.tasks.list.setData({ breachId }, previousTasks.map(t =>
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

  if (isLoading) return <div className="animate-pulse h-32 bg-gray-100 rounded-lg"></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Remediation & Containment Tasks</h3>
        <p className="text-sm text-gray-500 mt-1">Track tasks required to secure systems and prevent further exposure.</p>
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="New task title (e.g. Reset compromised passwords)"
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
          className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-md shadow-sm disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <div className="space-y-3 mt-4">
        {tasks?.length === 0 && <p className="text-sm text-gray-500 text-center py-4 border border-dashed rounded-lg">No tasks added yet.</p>}
        {tasks?.map(task => (
          <div key={task.id} className={`p-4 rounded-lg border flex items-start gap-4 ${task.status === 'completed' ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-gray-300 shadow-sm'}`}>
            <input 
              type="checkbox" 
              className="mt-1 h-5 w-5 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
              checked={task.status === 'completed'}
              onChange={e => updateTask.mutate({ id: task.id, status: e.target.checked ? 'completed' : 'pending' })}
            />
            <div className="flex-1">
              <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>{task.title}</p>
              {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
            </div>
            {task.priority === 'high' && <span className="px-2 py-1 bg-red-100 text-red-800 text-[10px] font-bold uppercase rounded">High</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
