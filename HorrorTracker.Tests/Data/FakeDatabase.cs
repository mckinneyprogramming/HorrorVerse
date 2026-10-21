using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using System.Data;

namespace HorrorTracker.Tests.Data;

internal sealed class RecordingLogger : ILoggerService
{
    public List<string> Information { get; } = [];
    public List<string> Warnings { get; } = [];
    public List<string> Errors { get; } = [];

    public void LogInformation(string message) => Information.Add(message);
    public void LogWarning(string message) => Warnings.Add(message);
    public void LogError(string message, Exception exception) => Errors.Add($"{message}:{exception.Message}");
    public void CloseAndFlush()
    {
    }
}

internal sealed class FakeConnection : IDatabaseConnection
{
    public int NonQueryResult { get; set; } = 1;
    public object? Scalar { get; set; } = 12.5m;
    public object?[][] Rows { get; set; } = [];
    public Exception? Failure { get; set; }
    public bool Opened { get; private set; }
    public bool Closed { get; private set; }
    public string? CommandText { get; set; }
    public List<(string Name, object Value)> Parameters { get; } = [];

    public void Open()
    {
        Opened = true;
        if (Failure is not null)
        {
            throw Failure;
        }
    }

    public void Close() => Closed = true;

    public IDatabaseCommand CreateCommand() => new FakeCommand(this);
}

internal sealed class FakeCommand(FakeConnection connection) : IDatabaseCommand
{
    public string CommandText { get; set; } = string.Empty;

    public void AddParameter(string parameterName, object value) => connection.Parameters.Add((parameterName, value));

    public int ExecuteNonQuery()
    {
        connection.CommandText = CommandText;
        return connection.NonQueryResult;
    }

    public object? ExecuteScalar()
    {
        connection.CommandText = CommandText;
        return connection.Scalar;
    }

    public IDataReader ExecuteReader()
    {
        connection.CommandText = CommandText;
        return new RowReader(connection.Rows);
    }
}

internal sealed class RowReader(object?[][] rows) : IDataReader
{
    private int _index = -1;

    public bool Read() => ++_index < rows.Length;

    public int GetInt32(int i) => Convert.ToInt32(Cell(i));
    public string GetString(int i) => (string)Cell(i)!;
    public decimal GetDecimal(int i) => Convert.ToDecimal(Cell(i));
    public bool GetBoolean(int i) => Convert.ToBoolean(Cell(i));
    public bool IsDBNull(int i) => Cell(i) is null or DBNull;

    public object this[int i] => Cell(i)!;
    public object this[string name] => throw new NotSupportedException(name);
    public int Depth => 0;
    public bool IsClosed => false;
    public int RecordsAffected => rows.Length;
    public int FieldCount => rows.Length == 0 ? 0 : rows[0].Length;
    public void Close() { }
    public void Dispose() { }
    public bool NextResult() => false;
    public DataTable? GetSchemaTable() => null;
    public string GetName(int i) => i.ToString();
    public int GetOrdinal(string name) => int.Parse(name);
    public object GetValue(int i) => Cell(i)!;
    public int GetValues(object[] values) => 0;
    public byte GetByte(int i) => 0;
    public long GetBytes(int i, long fieldOffset, byte[]? buffer, int bufferoffset, int length) => 0;
    public char GetChar(int i) => '\0';
    public long GetChars(int i, long fieldoffset, char[]? buffer, int bufferoffset, int length) => 0;
    public Guid GetGuid(int i) => Guid.Empty;
    public short GetInt16(int i) => 0;
    public long GetInt64(int i) => 0;
    public float GetFloat(int i) => 0;
    public double GetDouble(int i) => 0;
    public string GetDataTypeName(int i) => "text";
    public Type GetFieldType(int i) => typeof(object);
    public DateTime GetDateTime(int i) => DateTime.UnixEpoch;
    public IDataReader GetData(int i) => this;

    private object? Cell(int i) => rows[_index][i];
}
