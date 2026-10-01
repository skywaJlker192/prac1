using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using LiveMonitor.Hubs;
using LiveMonitor.Models;

namespace LiveMonitor.Services;

public class ConnectionTracker
{
    private readonly IHubContext<MonitorHub> _hubContext;
    private readonly ConcurrentDictionary<string, string> _connections = new();

    public ConnectionTracker(IHubContext<MonitorHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public string GetRoom(string connectionId)
    {
        return _connections.TryGetValue(connectionId, out var room) ? room : string.Empty;
    }

    public async Task RegisterAsync(string connectionId)
    {
        _connections[connectionId] = string.Empty;
        await BroadcastCountAsync();
        await BroadcastUsersAsync();
    }

    public async Task RemoveAsync(string connectionId)
    {
        _connections.TryRemove(connectionId, out _);
        await BroadcastCountAsync();
        await BroadcastUsersAsync();
    }

    public async Task UpdateRoomAsync(string connectionId, string room)
    {
        if (!_connections.ContainsKey(connectionId))
        {
            return;
        }

        _connections[connectionId] = room;
        await BroadcastUsersAsync();
    }

    public Task SendSystemMessageAsync(string text)
    {
        return _hubContext.Clients.All.SendAsync("SystemMessage", text);
    }

    public Task SendToRoomAsync(string room, string text)
    {
        return _hubContext.Clients.Group(room).SendAsync("ReceiveRoomMessage", "HTTP", room, text);
    }

    public Task SendPrivateAsync(string connectionId, string text)
    {
        return _hubContext.Clients.Client(connectionId).SendAsync("ReceivePrivateMessage", "HTTP", text);
    }

    private Task BroadcastCountAsync()
    {
        return _hubContext.Clients.All.SendAsync("OnlineCountUpdated", _connections.Count);
    }

    // Доп. задание (средний уровень): полный список пользователей с комнатами
    private Task BroadcastUsersAsync()
    {
        var users = _connections
            .Select(pair => new UserInfo(pair.Key, pair.Value))
            .ToList();

        return _hubContext.Clients.All.SendAsync("UsersUpdated", users);
    }
}
