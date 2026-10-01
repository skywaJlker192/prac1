using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.SignalR;
using LiveMonitor.Services;

namespace LiveMonitor.Hubs;

public class MonitorHub : Hub
{
    private readonly ConnectionTracker _tracker;

    public MonitorHub(ConnectionTracker tracker)
    {
        _tracker = tracker;
    }

    public override async Task OnConnectedAsync()
    {
        await _tracker.RegisterAsync(Context.ConnectionId);
        await Clients.Others.SendAsync("UserConnected", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await _tracker.RemoveAsync(Context.ConnectionId);
        await Clients.All.SendAsync("UserDisconnected", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(string text)
    {
        await Clients.All.SendAsync("ReceiveMessage", Context.ConnectionId, text);
    }

    public async Task JoinRoom(string room)
    {
        if (string.IsNullOrWhiteSpace(room))
        {
            throw new HubException("Название комнаты не может быть пустым");
        }

        room = room.Trim();

        var previousRoom = _tracker.GetRoom(Context.ConnectionId);
        if (!string.IsNullOrEmpty(previousRoom) && previousRoom != room)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, previousRoom);
            await Clients.Caller.SendAsync("LeftRoom", previousRoom);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, room);
        await _tracker.UpdateRoomAsync(Context.ConnectionId, room);
        await Clients.Caller.SendAsync("JoinedRoom", room);
    }

    public async Task LeaveRoom(string room)
    {
        if (string.IsNullOrWhiteSpace(room))
        {
            throw new HubException("Название комнаты не может быть пустым");
        }

        room = room.Trim();

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, room);

        if (_tracker.GetRoom(Context.ConnectionId) == room)
        {
            await _tracker.UpdateRoomAsync(Context.ConnectionId, string.Empty);
        }

        await Clients.Caller.SendAsync("LeftRoom", room);
    }

    public async Task SendToRoom(string room, string text)
    {
        if (string.IsNullOrWhiteSpace(room) || _tracker.GetRoom(Context.ConnectionId) != room.Trim())
        {
            throw new HubException("Сначала войдите в комнату");
        }

        await Clients.Group(room.Trim()).SendAsync("ReceiveRoomMessage", Context.ConnectionId, room.Trim(), text);
    }

    public async Task SendPrivate(string targetConnectionId, string text)
    {
        if (string.IsNullOrWhiteSpace(targetConnectionId))
        {
            throw new HubException("Укажите идентификатор получателя");
        }

        await Clients.Client(targetConnectionId.Trim()).SendAsync("ReceivePrivateMessage", Context.ConnectionId, text);
        await Clients.Caller.SendAsync("PrivateSent", targetConnectionId.Trim(), text);
    }

    // Доп. задание (лёгкий уровень): «Печатает…»
    public async Task Typing(string room)
    {
        if (string.IsNullOrWhiteSpace(room) || _tracker.GetRoom(Context.ConnectionId) != room.Trim())
        {
            return;
        }

        await Clients.OthersInGroup(room.Trim()).SendAsync("UserTyping", Context.ConnectionId);
    }

    // Доп. задание (сложный уровень): потоковая передача данных
    public async IAsyncEnumerable<int> StreamNumbers(
        int maxValue,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        if (maxValue < 1)
        {
            maxValue = 100;
        }

        while (!cancellationToken.IsCancellationRequested)
        {
            yield return Random.Shared.Next(0, maxValue + 1);

            try
            {
                await Task.Delay(500, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                yield break;
            }
        }
    }
}
