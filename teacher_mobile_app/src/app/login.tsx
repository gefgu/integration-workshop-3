import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import { useApp } from '../lib/AppContext';
import { colors, fonts, ui } from '../theme';

export default function Login() {
  const { api, login } = useApp();
  const [server, setServer] = useState(api.server || 'http://192.168.0.10:8000');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await login(server, email.trim(), password);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[ui.content, { flexGrow: 1, justifyContent: 'center' }]}>
          <View style={ui.card}>
            <Text style={{ fontFamily: fonts.heading, color: colors.accentDark, fontSize: 16 }}>TedTronics</Text>
            <Text style={ui.h1}>App do professor</Text>
            <Text style={ui.muted}>Entre com a mesma conta do site para levar módulos e buscar o progresso das bancadas.</Text>
            <Text style={ui.label}>Servidor</Text>
            <TextInput
              style={ui.input}
              value={server}
              onChangeText={setServer}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="Endereço do servidor"
            />
            <Text style={ui.label}>E-mail</Text>
            <TextInput
              style={ui.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              accessibilityLabel="E-mail"
            />
            <Text style={ui.label}>Senha</Text>
            <TextInput
              style={ui.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              accessibilityLabel="Senha"
              onSubmitEditing={submit}
            />
            {error ? <Text style={ui.error}>{error}</Text> : null}
            <Button title="Entrar" onPress={submit} busy={busy} disabled={!email || !password} />
            <Text style={ui.muted}>Ainda não tem conta? Crie pelo site do professor.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
