using System.Text.Json.Serialization;
using System.Net;
using System.Text.Json;

using Record = System.Collections.Generic.Dictionary<string, System.Text.Json.JsonElement>;

public sealed class NomenclatureHttpService : INomenclatureHttpService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<NomenclatureHttpService> _logger;
    private const string _requestText =
        "ВЫБРАТЬ " +
        "Номенклатура.Наименование КАК Наименование, " +
        "Номенклатура.Код КАК Артикул, " +
        "Номенклатура.Цена КАК Цена, " +
        "Номенклатура.ДатаПоставки КАК Дата_поставки, " +
        "Номенклатура.ЕдиницаИзмерения КАК Единица_измерения, " +
        "Номенклатура.Ссылка КАК Ссылка " +
        "ИЗ Справочник.Номенклатура КАК Номенклатура";

    // Настройки чтения и записи JSON — static readonly (создаются один раз)
    private static readonly JsonSerializerOptions JsonReadOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
    private static readonly JsonSerializerOptions JsonWriteOptions = new()
    {
        PropertyNamingPolicy = null,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public NomenclatureHttpService(
        HttpClient httpClient,
        ILogger<NomenclatureHttpService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    // POST /Request с телом запроса
    public Task<HttpRequestResult<IReadOnlyList<Record>>> GetNomenclatureAsync(
        CancellationToken cancellationToken = default)
    {
        const string requestUri = "Test/hs/api/v1/Request";

        var request = new NomenclatureRequestDto { RequestText = _requestText };
        string jsonBody = JsonSerializer.Serialize(request, JsonWriteOptions);

        return SendAndProcessAsync(
            requestUri,
            async token =>
            {
                // content живёт, пока идёт запрос, потом освобождается
                using HttpContent content = new StringContent(
                    jsonBody, System.Text.Encoding.UTF8, "application/json");
                return await _httpClient.PostAsync(requestUri, content, token);
            },
            cancellationToken);
    }

    // GET /Remains — без тела, просто обращение
    public Task<HttpRequestResult<IReadOnlyList<Record>>> GetRemainsAsync(
        CancellationToken cancellationToken = default)
    {
        const string requestUri = "Test/hs/api/v1/Remains";

        return SendAndProcessAsync(
            requestUri,
            token => _httpClient.GetAsync(requestUri, token),
            cancellationToken);
    }

    // Общая обёртка: отправка + обработка + единый набор catch-ов
    private async Task<HttpRequestResult<IReadOnlyList<Record>>> SendAndProcessAsync(
        string requestUri,
        Func<CancellationToken, Task<HttpResponseMessage>> send,
        CancellationToken cancellationToken)
    {
        try
        {
            using HttpResponseMessage response = await send(cancellationToken);
            return await ProcessResponseAsync(response, requestUri, cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "Request timeout for {Uri}", requestUri);
            return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                "Превышено время ожидания ответа от сервиса.");
        }
        catch (TaskCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return HttpRequestResult<IReadOnlyList<Record>>.Failure("Запрос был отменён.");
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Network error while requesting {Uri}", requestUri);
            return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                "Ошибка сети при обращении к сервису.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while requesting {Uri}", requestUri);
            return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                "Непредвиденная ошибка при обращении к сервису.");
        }
    }

    // Общая обработка ответа: код -> тело -> десериализация
    private async Task<HttpRequestResult<IReadOnlyList<Record>>> ProcessResponseAsync(
        HttpResponseMessage response,
        string requestUri,
        CancellationToken cancellationToken)
    {
        string responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        int statusCode = (int)response.StatusCode;

        if (!response.IsSuccessStatusCode)
        {
            string errorMessage = MapHttpError(statusCode, responseBody);
            _logger.LogWarning(
                "HTTP error {StatusCode} while requesting {Uri}. Body: {Body}",
                statusCode, requestUri, Truncate(responseBody));
            return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                errorMessage, statusCode, responseBody);
        }

        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return HttpRequestResult<IReadOnlyList<Record>>.Success(
                Array.Empty<Record>(), statusCode);
        }

        List<Record>? items;
        try
        {
            items = JsonSerializer.Deserialize<List<Record>>(responseBody, JsonReadOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to deserialize JSON from {Uri}", requestUri);
            return HttpRequestResult<IReadOnlyList<Record>>.Failure(
                "Сервис вернул некорректный JSON.", statusCode, responseBody);
        }

        return HttpRequestResult<IReadOnlyList<Record>>.Success(
            items ?? new List<Record>(), statusCode);
    }

    private static string MapHttpError(int statusCode, string responseBody) => statusCode switch
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

    private static string Truncate(string value, int maxLength = 500) =>
        value.Length <= maxLength ? value : value[..maxLength] + "...";
}