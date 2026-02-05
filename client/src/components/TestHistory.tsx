import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  History, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  BarChart3, 
  Clock, 
  Target,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  GitCompare
} from 'lucide-react';

interface TestHistoryProps {
  onCompare?: (records: any[]) => void;
}

export function TestHistory({ onCompare }: TestHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: records, isLoading, refetch } = trpc.testRecords.list.useQuery(
    { limit: 50 },
    { enabled: isOpen }
  );

  const deleteMutation = trpc.testRecords.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const updateNameMutation = trpc.testRecords.updateName.useMutation({
    onSuccess: () => {
      setEditingId(null);
      refetch();
    },
  });

  const handleDelete = (id: number) => {
    if (confirm('确定要删除这条测试记录吗？')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleStartEdit = (id: number, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleSaveEdit = (id: number) => {
    if (editName.trim()) {
      updateNameMutation.mutate({ id, name: editName.trim() });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleCompare = () => {
    if (selectedIds.length >= 2 && records) {
      const selectedRecords = records.filter(r => selectedIds.includes(r.id));
      onCompare?.(selectedRecords);
      setIsOpen(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'cancelled': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '完成';
      case 'failed': return '失败';
      case 'cancelled': return '取消';
      default: return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          历史记录
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="w-5 h-5" />
              测试历史记录
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {selectedIds.length >= 2 && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleCompare}
                  className="gap-2"
                >
                  <GitCompare className="w-4 h-4" />
                  对比 ({selectedIds.length})
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : records && records.length > 0 ? (
            records.map((record) => (
              <Card 
                key={record.id} 
                className={`transition-all ${selectedIds.includes(record.id) ? 'ring-2 ring-primary' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox for comparison */}
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedIds.includes(record.id)}
                        onCheckedChange={() => toggleSelect(record.id)}
                      />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {editingId === record.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-7 w-48"
                                autoFocus
                              />
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0"
                                onClick={() => handleSaveEdit(record.id)}
                              >
                                <Check className="w-4 h-4 text-green-400" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="font-medium truncate max-w-[200px]">{record.name}</span>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0"
                                onClick={() => handleStartEdit(record.id, record.name)}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          <span className={`text-xs ${getStatusColor(record.status)}`}>
                            {getStatusText(record.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDate(record.createdAt)}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* URL */}
                      <div className="text-xs text-muted-foreground mb-2 truncate">
                        <span className="text-primary font-mono">{record.method}</span>
                        <span className="ml-2">{record.url}</span>
                      </div>

                      {/* Metrics grid */}
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-400" />
                          <div>
                            <div className="text-xs text-muted-foreground">总请求</div>
                            <div className="font-mono">{record.totalRequests.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                          <div>
                            <div className="text-xs text-muted-foreground">成功率</div>
                            <div className="font-mono">
                              {record.totalRequests > 0 
                                ? ((record.successCount / record.totalRequests) * 100).toFixed(1)
                                : 0}%
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-cyan-400" />
                          <div>
                            <div className="text-xs text-muted-foreground">吞吐量</div>
                            <div className="font-mono">{record.throughput} req/s</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                          <div>
                            <div className="text-xs text-muted-foreground">平均延迟</div>
                            <div className="font-mono">{record.avgLatency}ms</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mb-4 opacity-50" />
              <p>暂无测试记录</p>
              <p className="text-sm">完成测试后可在此查看历史记录</p>
            </div>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              已选择 {selectedIds.length} 条记录
              {selectedIds.length >= 2 && '，点击"对比"按钮进行性能对比分析'}
              {selectedIds.length === 1 && '，请再选择至少1条记录进行对比'}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
