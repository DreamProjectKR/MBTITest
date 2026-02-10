-- Auto-generated from assets/<test-*>/test.json + seed/seed-config.json
-- DO NOT EDIT BY HAND (edit config/JSON, then re-run: node scripts/generate_d1_seed.cjs)

PRAGMA foreign_keys = ON;

DELETE FROM tests;

-- test: test-root-vegetables
INSERT INTO tests (test_id, title, description_json, author, author_img_path, thumbnail_path, source_path, tags_json, question_count, is_published, created_at, updated_at) VALUES ( 'test-root-vegetables', '뿌리채소 성향 테스트', '["뿌리뿌리 뿌리채소 유형 ✨","뿌리채소 농장에서 친구들 이끌고 신나게 돌아다니고 싶은지,","혼자 조용히 뿌리채소의 질감을 음미하고 싶은지… 👀","이런 당신의 뿌리채소 스타일로","MBTI 성격 유형을 살짝 들여다봐요 💕","몇 가지 질문에 답하면","✔️ 당신이 어떤 뿌리채소 취향을 더 좋아하는지","✔️ 어떤 포인트에 끌리는 타입인지","귀여운 뿌리채소·캐릭터 해설과 함께","콕콕 알려드릴게요 🥔🍠🥕🧅🌰"]', '라푸', 'assets/test-root-vegetables/images/author.png', 'assets/test-root-vegetables/images/thumbnail.png', 'test-root-vegetables/test.json', '["뿌리채소","캐릭터","MBTI"]', 12, 1, '2025-12-26', '2025-12-26' );

-- test: test-summer
INSERT INTO tests (test_id, title, description_json, author, author_img_path, thumbnail_path, source_path, tags_json, question_count, is_published, created_at, updated_at) VALUES ( 'test-summer', '여름 바캉스 스타일 테스트', '["두근두근 여름방학 유형 ✨","여름방학에 친구들이랑 미친 듯이 놀고 싶은지,","혼자 조용히 책 읽으며 쉬고 싶은지… 👀","이런 당신의 방학 스타일로","성격 유형을 살짝 들여다봐요 💕","몇 가지 질문에 답하면","✔️ 당신이 어떤 방학 계획을 더 좋아하는지","✔️ 어떤 포인트에 끌리는 타입인지","귀여운 동물·캐릭터 해설과 함께","콕콕 알려드릴게요 🐰🦉🦔🦥🦩"]', '우애앵애', 'assets/test-summer/images/author.png', 'assets/test-summer/images/thumbnail.png', 'test-summer/test.json', '["여름","여행","휴가","바캉스"]', 12, 1, '2025-12-08', '2025-12-08' );
