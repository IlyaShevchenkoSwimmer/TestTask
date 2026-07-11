
// Универсальный результат HTTP-запроса.
// Позволяет обрабатывать ошибки без падения приложения.

public sealed class HttpRequestResult<T>
{
    // true — запрос успешен и данные получены
    public bool IsSuccess { get; init; }
    // Данные (список товаров). null при ошибке
    public T? Data { get; init; }
    // HTTP-код: 200, 404, 500 и т.д.
    public int? StatusCode { get; init; }
    // Сообщение для логов или ответа API
    public string? ErrorMessage { get; init; }
    // Тело ответа при ошибке (для отладки)
    public string? RawResponse { get; init; }
    public static HttpRequestResult<T> Success(T data, int statusCode) =>
        new()
        {
            IsSuccess = true,
            Data = data,
            StatusCode = statusCode
        };
    public static HttpRequestResult<T> Failure(
        string errorMessage,
        int? statusCode = null,
        string? rawResponse = null) =>
        new()
        {
            IsSuccess = false,
            ErrorMessage = errorMessage,
            StatusCode = statusCode,
            RawResponse = rawResponse
        };
}