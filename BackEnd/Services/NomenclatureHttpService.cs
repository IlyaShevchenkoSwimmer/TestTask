using System.Text.Json.Serialization;
using System.Net;
using System.Text.Json;

// типизация объекта JSON. От HTTP-сервиса в ответ получаем массив таких объектов 
// (свойство = строка и значение = элемент JSON)
using Record = System.Collections.Generic.Dictionary<string, System.Text.Json.JsonElement>;

/// <summary>
/// Сервис, который ходит во внешний HTTP API и возвращает список товаров.
/// </summary>
public sealed class NomenclatureHttpService : INomenclatureHttpService
{
    // HttpClient внедряется через DI (IHttpClientFactory) — так правильно в ASP.NET Core
    private readonly HttpClient _httpClient;
    // Логгер — пишем предупреждения и ошибки, не роняя приложение
    private readonly ILogger<NomenclatureHttpService> _logger;
    // Настройки JSON: нечувствительность к регистру имён свойств
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
    public NomenclatureHttpService(
        HttpClient httpClient,
        ILogger<NomenclatureHttpService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }
    public async Task<HttpRequestResult<IReadOnlyList<Record>>> GetNomenclatureAsync(
        CancellationToken cancellationToken = default)
    {
        // Относительный путь. BaseAddress задаётся в Program.cs
        const string requestUri = "Test/hs/api/v1/Request";

        // 1. Создаём объект с данными (или получаем его как параметр)
     var request = new NomenclatureRequestDto
     {
         requestText = "ВЫБРАТЬ Номенклатура.ДатаПоставки КАК ДатаПоставки, Номенклатура.ПометкаУдаления КАК ПометкаУдаления, Номенклатура.ЕдиницаИзмерения КАК ЕдИзмер, Номенклатура.Ссылка КАК Ссылка, Номенклатура.Наименование КАК Наименование, Номенклатура.Код КАК Артикул, Номенклатура.Цена КАК Цена ИЗ Справочник.Номенклатура КАК Номенклатура"
    };
    // 2. Сериализуем объект в JSON-строку
    var jsonOptions = new JsonSerializerOptions
    {
        PropertyNamingPolicy = null, // оставляем имена из [JsonPropertyName]
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
    string jsonBody = JsonSerializer.Serialize(request, jsonOptions);
    
    // 3. Оборачиваем JSON в HttpContent
    using HttpContent content = new StringContent(
        jsonBody,
        System.Text.Encoding.UTF8,
        "application/json"); // Content-Type: application/json

        try
        {
            // GET-запрос.
            // ResponseHeadersRead — начинаем читать тело только после заголовков (экономия памяти).
            using HttpResponseMessage response = await _httpClient.PostAsync(
                requestUri,
                content,
                cancellationToken);

            // Читаем тело ответа как строку (и при 200, и при 404/500)
            string responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            // Числовой код: 200, 404, 500...
            int statusCode = (int)response.StatusCode;
            // Любой код не из диапазона 2xx — ошибка
            if (!response.IsSuccessStatusCode)
            {
                // Человекочитаемое сообщение по коду
                string errorMessage = MapHttpError(statusCode, responseBody);
                _logger.LogWarning(
                    "HTTP error {StatusCode} while requesting {Uri}. Body: {Body}",
                    statusCode,
                    requestUri,
                    Truncate(responseBody));
                // Возвращаем Failure — исключение не бросаем
                return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                    errorMessage,
                    statusCode,
                    responseBody);
            }
            // Успешный ответ, но тело пустое — отдаём пустой список
            if (string.IsNullOrWhiteSpace(responseBody))
            {
                return HttpRequestResult<IReadOnlyList<Record>>.Success(
                    Array.Empty<Record>(),
                    statusCode);
            }
            // Парсим JSON в List<NomenclatureItemDto>
            List<Record>? items;
            try
            {
                items = JsonSerializer.Deserialize<List<Record>>(
                    responseBody,
                    JsonOptions);
            }
            catch (JsonException ex)
            {
                // Сервер ответил 200, но JSON битый — отдельный сценарий
                _logger.LogError(ex, "Failed to deserialize JSON from {Uri}", requestUri);
                return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                    "Сервис вернул некорректный JSON.",
                    statusCode,
                    responseBody);
            }
            // Успех: список (или пустой, если deserialize вернул null)
            return HttpRequestResult<IReadOnlyList<Record>>.Success(
                items ?? new List<Record>(),
                statusCode);
        }
        // Таймаут HttpClient (не отмена пользователем)
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "Request timeout for {Uri}", requestUri);
            return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                "Превышено время ожидания ответа от сервиса.");
        }
        // Явная отмена через CancellationToken
        catch (TaskCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                "Запрос был отменён.");
        }
        // DNS, SSL, разрыв соединения и т.п.
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Network error while requesting {Uri}", requestUri);
            return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                "Ошибка сети при обращении к сервису.");
        }
        // Любая непредвиденная ошибка — логируем и возвращаем Failure
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while requesting {Uri}", requestUri);
            return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                "Непредвиденная ошибка при обращении к сервису.");
        }
    }
    /// <summary>
    /// Превращает HTTP-код в понятное сообщение для клиента API.
    /// </summary>
    private static string MapHttpError(int statusCode, string responseBody)
    {
        return statusCode switch
        {
            (int)HttpStatusCode.BadRequest => "Некорректный запрос (400).",
            (int)HttpStatusCode.Unauthorized => "Требуется авторизация (401).",
            (int)HttpStatusCode.Forbidden => "Доступ запрещён (403).",
            (int)HttpStatusCode.NotFound => "Ресурс не найден (404).",
            (int)HttpStatusCode.Conflict => "Конфликт данных (409).",
            (int)HttpStatusCode.UnprocessableEntity => "Данные не прошли валидацию (422).",
            (int)HttpStatusCode.TooManyRequests => "Слишком много запросов (429).",
            >= 500 and < 600 => "Ошибка на стороне сервера (5xx).",
            _ => $"Сервис вернул ошибку ({statusCode})."
        };
    }
    /// <summary>
    /// Обрезает длинный текст ответа для логов.
    /// </summary>
    private static string Truncate(string value, int maxLength = 500) =>
        value.Length <= maxLength ? value : value[..maxLength] + "...";
}