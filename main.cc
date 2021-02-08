#include <iostream>
#include <string>
#include <vector>
#include <functional>
#include <variant>
#include <tuple>
#include <memory>

#include "main.h"
#include "declarative.h"


// can i use template deduction on declarative?
// need a declarative manager
// need to use smart pointers in declarative

std::vector <DeclarativeInterface*> mydecls;

void test1(int& a, int& b) {
  std::cout << a + b << std::endl;
  a += 5;
  b += 5;
}
void test2(std::string name) { std::cout << name << std::endl; }

void Declare_test1(int a, int b) {
  // auto decl_test1 = new Declarative<void(int&, int&)>;
  // auto b = new Declarative(test1, 5, 10);
  // decl_test1->assign(test1, a, b);
  // mydecls.push_back(decl_test1);

}
void Declare_test2(std::string name) {
}


void init() {
  Declare_test1(5, 10);
  Declare_test2("hello");
}

void run() {
  for (auto fn : mydecls) {
    fn->operator()();
  }
}

void draw() {
  Declare::Window::Area(50,50,250,250);
  Declare::Window::Type::Theme(windowTheme);
  {
    Declare::Window::Area(5, 5, 5, 5); // make this inherit area from parent?

    int count = 0;
    Declare::Var::Int count = 0;
    Declare::Button::Label("count: %d", count);
    Declare::Button::OnPress(lambda(count ++));

    Declare::Button::OnMove(ui.mouseMoved());
    Declare::Button::Move(50, 50);
  }
}

void shutdown() {
  for (auto fn : mydecls) {
    delete fn;
  }
}

template <class Signature>
class Functor;

template <class Ret, class... Args>
class Functor <Ret(Args...)> {
  public:
  Functor(Ret(*func)(Args...)) {

  }

  Ret(_func)(Args...);
  std::tuple<Args...> _params;
};

template <class Fun>
class Hmm {
 public:
  Hmm(Fun fun) {
  }
};


int main() {
  init();
  run();
  run();
  shutdown();
  std::string str;
  std::vector<int> vec;

//  Hmm(init);

}
