using Microsoft.Extensions.Options;

// Загружаем .env в переменные окружения процесса.
if (File.Exists(".env"))
    DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<ApiCredentials>(builder.Configuration.GetSection("ApiCredentials"));

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

// Регистрируем типизированный HttpClient.
// Фабрика создаёт и переиспользует HttpClient — не делаем new HttpClient() вручную.
builder.Services.AddHttpClient<INomenclatureHttpService, NomenclatureHttpService>(
    (serviceProvider, client) =>
{
    // Достаём заполненные настройки из DI
    var credentials = serviceProvider
        .GetRequiredService<IOptions<ApiCredentials>>()
        .Value;

    // Адрес сервера
    client.BaseAddress = new Uri(credentials.BaseAddress);
    // Таймаут всего запроса (по умолчанию 100 сек, 
    // 30 указали явно, тк в наших условиях ответ приходит довольно быстро)
    client.Timeout = TimeSpan.FromSeconds(30);
    // Заголовок, если сервис требует JSON
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
    
    // авторизация логином и паролем, сохраненными в .env
    var auth = Convert.ToBase64String(
        System.Text.Encoding.UTF8.GetBytes($"{credentials.Login}:{credentials.Password}"));
    client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", auth);
});

var app = builder.Build();

app.UseCors();

app.MapGet("/api/nomenclature/request/", async (
    INomenclatureHttpService nomenclatureService,   // DI подставит сервис автоматически
    CancellationToken cancellationToken) =>       // токен отмены от ASP.NET Core
{
    // Вызываем метод, который ходит в HTTP-сервис
    var result = await nomenclatureService.GetNomenclatureAsync(cancellationToken);
    // Если сервис вернул ошибку — отдаём её клиенту, приложение не падает
    // Ошибка 502 по умолчанию, если не дождались ответа сервиса
    if (!result.IsSuccess)
    {
        return Results.Json(
            new { error = result.ErrorMessage },
            statusCode: result.StatusCode ?? StatusCodes.Status502BadGateway);
    }
    // Успех — отдаём массив товаров
    return Results.Ok(result.Data);
});

app.MapGet("/api/nomenclature/remains", async (
    INomenclatureHttpService nomenclatureService,
    CancellationToken cancellationToken) =>
{
    var result = await nomenclatureService.GetRemainsAsync(cancellationToken);

    if (!result.IsSuccess)
    {
        return Results.Json(
            new { error = result.ErrorMessage },
            statusCode: result.StatusCode ?? StatusCodes.Status502BadGateway);
    }

    return Results.Ok(result.Data);
});

app.Run();
