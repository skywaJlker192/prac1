namespace LiveMonitor.Models;

public record TextRequest(string? Text);

public record RoomRequest(string? Room, string? Text);

public record PrivateRequest(string? ConnectionId, string? Text);

public record UserInfo(string ConnectionId, string Room);
