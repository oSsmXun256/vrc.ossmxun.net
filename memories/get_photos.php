<?php
header('Content-Type: application/json');

$imageDir = './photos/low/'; // HTMLファイルおよびこのPHPファイルから見た相対パス
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']; // 許可する画像の拡張子
$files = [];

// ディレクトリが存在するか確認
if (is_dir($imageDir)) {
    // globを使って指定された拡張子のファイルを取得
    // {jpg,jpeg,png,gif,webp} のように複数の拡張子を指定可能
    $foundFiles = glob($imageDir . '*.{' . implode(',', $allowedExtensions) . '}', GLOB_BRACE);

    if ($foundFiles) {
        foreach ($foundFiles as $file) {
            // ファイル名だけではなく、クライアントがアクセスできるパスを返す
            // この例ではHTMLからの相対パスをそのまま使用
            $files[] = $file;
        }
    }
} else {
    // ディレクトリが存在しない場合のエラーメッセージ (デバッグ用)
    // echo json_encode(['error' => 'Image directory not found.']);
    // exit;
    // 本番環境では、空の配列を返すか、より適切なエラー処理を検討してください。
}

echo json_encode($files);
?>