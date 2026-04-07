package service_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/service"
	"github.com/stretchr/testify/require"
)

// ---- mock user repository ----

type mockUserRepo struct {
	users  map[string]*model.User // keyed by email
	byID   map[string]*model.User
	nextID int
}

func newMockUserRepo() *mockUserRepo {
	return &mockUserRepo{
		users: make(map[string]*model.User),
		byID:  make(map[string]*model.User),
	}
}

func (m *mockUserRepo) Create(u *model.User) error {
	if _, exists := m.users[u.Email]; exists {
		return errors.New("email already exists")
	}
	m.nextID++
	u.ID = fmt.Sprintf("user-%d", m.nextID)
	m.users[u.Email] = u
	m.byID[u.ID] = u
	return nil
}

func (m *mockUserRepo) GetByEmail(email string) (*model.User, error) {
	u, ok := m.users[email]
	if !ok {
		return nil, errors.New("not found")
	}
	return u, nil
}

func (m *mockUserRepo) GetByID(id string) (*model.User, error) {
	u, ok := m.byID[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return u, nil
}

// ---- tests ----

func TestAuthService_Register_HashesPassword(t *testing.T) {
	repo := newMockUserRepo()
	svc := service.NewAuthService(repo, "test-secret")

	user, err := svc.Register("alice@example.com", "plaintext123", "Alice")
	require.NoError(t, err)
	require.NotEqual(t, "plaintext123", user.PasswordHash)
	require.Greater(t, len(user.PasswordHash), 20, "should be bcrypt hash")
}

func TestAuthService_Register_SetsRoleUser(t *testing.T) {
	repo := newMockUserRepo()
	svc := service.NewAuthService(repo, "test-secret")

	user, err := svc.Register("bob@example.com", "password", "Bob")
	require.NoError(t, err)
	require.Equal(t, model.RoleUser, user.Role)
}

func TestAuthService_Login_ReturnsJWT(t *testing.T) {
	repo := newMockUserRepo()
	svc := service.NewAuthService(repo, "test-secret")

	_, err := svc.Register("bob@example.com", "password", "Bob")
	require.NoError(t, err)

	token, err := svc.Login("bob@example.com", "password")
	require.NoError(t, err)
	require.NotEmpty(t, token)
}

func TestAuthService_Login_WrongPassword(t *testing.T) {
	repo := newMockUserRepo()
	svc := service.NewAuthService(repo, "test-secret")

	_, err := svc.Register("carol@example.com", "correct", "Carol")
	require.NoError(t, err)

	_, err = svc.Login("carol@example.com", "wrong")
	require.ErrorIs(t, err, service.ErrInvalidCredentials)
}

func TestAuthService_Login_UnknownEmail(t *testing.T) {
	repo := newMockUserRepo()
	svc := service.NewAuthService(repo, "test-secret")

	_, err := svc.Login("nobody@example.com", "password")
	require.ErrorIs(t, err, service.ErrInvalidCredentials)
}
