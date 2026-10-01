using LiveMonitor.Hubs;
using LiveMonitor.Models;
using LiveMonitor.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddSingleton<ConnectionTracker>();

builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5050",
                "http://127.0.0.1:5500",
                "http://localhost:5500")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors("Frontend");

app.MapHub<MonitorHub>("/hubs/monitor");

app.MapPost("/api/system-message", async (TextRequest? request, ConnectionTracker tracker) =>
{
    var text = string.IsNullOrWhiteSpace(request?.Text)
        ? "Системное сообщение от сервера"
        : request!.Text!;

    await tracker.SendSystemMessageAsync(text);
    return Results.Ok(new { sent = true });
});

app.MapPost("/api/room-notification", async (RoomRequest? request, ConnectionTracker tracker) =>
{
    if (string.IsNullOrWhiteSpace(request?.Room) || string.IsNullOrWhiteSpace(request.Text))
    {
        return Results.BadRequest(new { error = "Нужны поля room и text" });
    }

    await tracker.SendToRoomAsync(request.Room.Trim(), request.Text);
    return Results.Ok(new { sent = true });
});

app.MapPost("/api/private-message", async (PrivateRequest? request, ConnectionTracker tracker) =>
{
    if (string.IsNullOrWhiteSpace(request?.ConnectionId) || string.IsNullOrWhiteSpace(request.Text))
    {
        return Results.BadRequest(new { error = "Нужны поля connectionId и text" });
    }

    await tracker.SendPrivateAsync(request.ConnectionId.Trim(), request.Text);
    return Results.Ok(new { sent = true });
});

app.Run();
