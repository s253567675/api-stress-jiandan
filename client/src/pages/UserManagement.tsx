/**
 * User Management Page - Admin only
 * Allows administrators to create, edit, and manage user accounts
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  UserPlus, 
  Pencil, 
  Trash2, 
  AlertCircle,
  Users,
  Shield,
  UserCheck,
  UserX,
  ArrowLeft,
  Gauge,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

type UserFormData = {
  username: string;
  password: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
};

const initialFormData: UserFormData = {
  username: '',
  password: '',
  name: '',
  email: '',
  role: 'user',
};

export default function UserManagement() {
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    role: 'user' | 'admin';
    isActive: number;
    password: string;
  }>({
    name: '',
    email: '',
    role: 'user',
    isActive: 1,
    password: '',
  });
  const [error, setError] = useState('');

  const utils = trpc.useUtils();

  // Fetch users
  const { data: users, isLoading } = trpc.users.list.useQuery();

  // Create user mutation
  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success('用户创建成功');
      setIsCreateOpen(false);
      setFormData(initialFormData);
      utils.users.list.invalidate();
    },
    onError: (err) => {
      setError(err.message || '创建用户失败');
    },
  });

  // Update user mutation
  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success('用户更新成功');
      setIsEditOpen(false);
      setEditingUserId(null);
      utils.users.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || '更新用户失败');
    },
  });

  // Delete user mutation
  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success('用户删除成功');
      utils.users.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || '删除用户失败');
    },
  });

  const handleCreate = () => {
    setError('');
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('用户名和密码不能为空');
      return;
    }
    if (formData.password.length < 6) {
      setError('密码至少需要6个字符');
      return;
    }
    createMutation.mutate({
      username: formData.username.trim(),
      password: formData.password,
      name: formData.name.trim() || undefined,
      email: formData.email.trim() || undefined,
      role: formData.role,
    });
  };

  const handleEdit = (user: NonNullable<typeof users>[0]) => {
    setEditingUserId(user.id);
    setEditFormData({
      name: user.name || '',
      email: user.email || '',
      role: user.role,
      isActive: user.isActive,
      password: '',
    });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingUserId) return;
    updateMutation.mutate({
      id: editingUserId,
      name: editFormData.name.trim() || undefined,
      email: editFormData.email.trim() || null,
      role: editFormData.role,
      isActive: editFormData.isActive,
      password: editFormData.password.trim() || undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('确定要删除此用户吗？此操作不可恢复。')) {
      deleteMutation.mutate({ id });
    }
  };

  // Statistics
  const totalUsers = users?.length || 0;
  const adminCount = users?.filter(u => u.role === 'admin').length || 0;
  const activeCount = users?.filter(u => u.isActive === 1).length || 0;
  const inactiveCount = users?.filter(u => u.isActive !== 1).length || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/')}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Gauge className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">用户管理</h1>
                <p className="text-muted-foreground">管理系统用户账号和权限</p>
              </div>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                创建用户
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新用户</DialogTitle>
                <DialogDescription>
                  填写以下信息创建新的用户账号
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="create-username">用户名 *</Label>
                  <Input
                    id="create-username"
                    placeholder="只能包含字母、数字和下划线"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">密码 *</Label>
                  <Input
                    id="create-password"
                    type="password"
                    placeholder="至少6个字符"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-name">显示名称</Label>
                  <Input
                    id="create-name"
                    placeholder="可选"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">邮箱</Label>
                  <Input
                    id="create-email"
                    type="email"
                    placeholder="可选"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-role">角色</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: 'user' | 'admin') => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">普通用户</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    '创建'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总用户数</p>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-chart-4/10">
                  <Shield className="h-6 w-6 text-chart-4" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">管理员</p>
                  <p className="text-2xl font-bold">{adminCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-chart-3/10">
                  <UserCheck className="h-6 w-6 text-chart-3" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">活跃用户</p>
                  <p className="text-2xl font-bold">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <UserX className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">已禁用</p>
                  <p className="text-2xl font-bold">{inactiveCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Table */}
        <Card>
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>管理所有系统用户</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : users && users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>显示名称</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>最后登录</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono">{user.username || '-'}</TableCell>
                      <TableCell>{user.name || '-'}</TableCell>
                      <TableCell>{user.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? '管理员' : '普通用户'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive === 1 ? 'outline' : 'destructive'}>
                          {user.isActive === 1 ? '活跃' : '已禁用'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                暂无用户数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑用户</DialogTitle>
              <DialogDescription>
                修改用户信息
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">显示名称</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">邮箱</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">角色</Label>
                <Select
                  value={editFormData.role}
                  onValueChange={(value: 'user' | 'admin') => setEditFormData({ ...editFormData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">状态</Label>
                <Select
                  value={String(editFormData.isActive)}
                  onValueChange={(value) => setEditFormData({ ...editFormData, isActive: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">活跃</SelectItem>
                    <SelectItem value="0">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">新密码</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="留空则不修改密码"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
